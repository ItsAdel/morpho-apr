import { pool } from "../config/database";

// Types
export interface ReimbursementSummary {
  address: string;
  entityType: "vault" | "borrower" | "unknown";
  entityName?: string;
  totalOwed: number;
  pendingReimbursements: number;
  completedReimbursements: number;
  failedReimbursements: number;
  positions: PositionReimbursement[];
}

export interface PositionReimbursement {
  marketName: string;
  marketId: string;
  totalInterestAccrued: number;
  totalReimbursable: number;
  currentDebt: number;
  lastSnapshotDate: string | null;
  status: string;
}

/**
 * Unified Reimbursement Service
 * Handles both querying and processing of reimbursements
 */
export class ReimbursementService {
  // ==================== QUERY METHODS ====================

  /**
   * Query reimbursements for any address (vault or borrower)
   */
  async getReimbursementsForAddress(
    address: string
  ): Promise<ReimbursementSummary | null> {
    const normalizedAddress = address.toLowerCase();

    // Check if it's a vault
    const vaultCheck = await pool.query(
      "SELECT id, name FROM vaults WHERE LOWER(address) = $1",
      [normalizedAddress]
    );

    // Check if it's a borrower
    const borrowerCheck = await pool.query(
      "SELECT id FROM borrowers WHERE LOWER(address) = $1",
      [normalizedAddress]
    );

    let entityId: number;
    let entityType: "vault" | "borrower" | "unknown";
    let entityName: string | undefined;

    if (vaultCheck.rows.length > 0) {
      entityId = vaultCheck.rows[0].id;
      entityType = "vault";
      entityName = vaultCheck.rows[0].name;
    } else if (borrowerCheck.rows.length > 0) {
      entityId = borrowerCheck.rows[0].id;
      entityType = "borrower";
    } else {
      return null;
    }

    const positions = await this.getPositionSummaries(entityId, entityType);
    const reimbursementStats = await this.getReimbursementStats(
      entityId,
      entityType
    );

    return {
      address: address,
      entityType,
      entityName,
      totalOwed: reimbursementStats.totalPending,
      pendingReimbursements: reimbursementStats.pendingCount,
      completedReimbursements: reimbursementStats.completedCount,
      failedReimbursements: reimbursementStats.failedCount,
      positions,
    };
  }

  /**
   * Get all borrowers who are owed reimbursements
   * This shows WHO needs to be paid (the borrowers)
   */
  async getPendingBorrowerReimbursements(): Promise<{
    borrowers: Array<{
      address: string;
      totalOwed: number;
      pendingCount: number;
      markets: string[];
    }>;
    totalOwedAcrossAllBorrowers: number;
  }> {
    const result = await pool.query(`
      SELECT 
        b.address,
        b.id as borrower_id,
        COALESCE(SUM(CASE WHEN r.status = 'pending' THEN r.amount ELSE 0 END), 0) as total_owed,
        COUNT(CASE WHEN r.status = 'pending' THEN 1 END) as pending_count,
        ARRAY_AGG(DISTINCT m.name) as markets
      FROM borrowers b
      JOIN borrower_positions bp ON bp.borrower_id = b.id
      LEFT JOIN reimbursements r ON r.position_id = bp.id
      LEFT JOIN markets m ON m.market_id = bp.market_id
      WHERE bp.status = 'active'
      GROUP BY b.id, b.address
      HAVING COUNT(CASE WHEN r.status = 'pending' THEN 1 END) > 0
      ORDER BY total_owed DESC
    `);

    const borrowers = result.rows.map((row) => ({
      address: row.address,
      totalOwed: parseFloat(row.total_owed || 0),
      pendingCount: parseInt(row.pending_count || 0),
      markets: row.markets || [],
    }));

    const totalOwedAcrossAllBorrowers = borrowers.reduce(
      (sum, b) => sum + b.totalOwed,
      0
    );

    return { borrowers, totalOwedAcrossAllBorrowers };
  }

  /**
   * Get vault reimbursement pool (excess interest that needs to be reimbursed)
   * This shows HOW MUCH vaults earned above cap that must be paid out
   */
  async getVaultReimbursementPool(): Promise<{
    vaults: Array<{
      name: string;
      address: string;
      excessByToken: Array<{ token: string; amount: number }>;
      markets: number;
    }>;
    totalsByToken: Array<{ token: string; total: number }>;
  }> {
    const result = await pool.query(`
      SELECT 
        v.name,
        v.address,
        vss.loan_asset,
        COUNT(DISTINCT vss.market_id) as markets,
        COALESCE(SUM(vss.interest_above_cap), 0) as excess_interest
      FROM vaults v
      JOIN vault_supply_snapshots vss ON vss.vault_id = v.id
      WHERE vss.snapshot_date >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY v.id, v.name, v.address, vss.loan_asset
      HAVING SUM(vss.interest_above_cap) > 0
      ORDER BY v.name, vss.loan_asset
    `);

    // Group by vault, showing excess by token
    const vaultMap = new Map();
    result.rows.forEach((row) => {
      if (!vaultMap.has(row.address)) {
        vaultMap.set(row.address, {
          name: row.name,
          address: row.address,
          excessByToken: [],
          markets: 0,
        });
      }
      const vault = vaultMap.get(row.address);
      vault.excessByToken.push({
        token: row.loan_asset,
        amount: parseFloat(row.excess_interest || 0),
      });
      vault.markets += parseInt(row.markets || 0);
    });

    const vaults = Array.from(vaultMap.values());

    // Calculate totals by token
    const tokenTotals = new Map();
    result.rows.forEach((row) => {
      const token = row.loan_asset;
      const current = tokenTotals.get(token) || 0;
      tokenTotals.set(token, current + parseFloat(row.excess_interest || 0));
    });

    const totalsByToken = Array.from(tokenTotals.entries()).map(
      ([token, total]) => ({
        token,
        total,
      })
    );

    return { vaults, totalsByToken };
  }

  /**
   * Get detailed reimbursement history for an address
   */
  async getReimbursementHistory(
    address: string,
    limit: number = 50
  ): Promise<any[]> {
    const normalizedAddress = address.toLowerCase();

    const result = await pool.query(
      `
      SELECT 
        r.id,
        r.amount,
        r.period_start,
        r.period_end,
        r.status,
        r.tx_hash,
        r.created_at,
        r.processed_at,
        m.name as market_name,
        m.market_id
      FROM reimbursements r
      JOIN borrower_positions bp ON r.position_id = bp.id
      JOIN markets m ON bp.market_id = m.market_id
      LEFT JOIN vaults v ON bp.vault_id = v.id
      LEFT JOIN borrowers b ON bp.borrower_id = b.id
      WHERE LOWER(COALESCE(v.address, b.address)) = $1
      ORDER BY r.created_at DESC
      LIMIT $2
    `,
      [normalizedAddress, limit]
    );

    return result.rows;
  }

  private async getPositionSummaries(
    entityId: number,
    entityType: "vault" | "borrower"
  ): Promise<PositionReimbursement[]> {
    const query = `
      SELECT 
        bp.id as position_id,
        m.name as market_name,
        m.market_id,
        bp.current_debt,
        bp.status,
        COALESCE(SUM(isn.interest_accrued), 0) as total_interest_accrued,
        COALESCE(SUM(isn.interest_above_cap), 0) as total_reimbursable,
        MAX(isn.snapshot_date) as last_snapshot_date
      FROM borrower_positions bp
      JOIN markets m ON bp.market_id = m.market_id
      LEFT JOIN interest_snapshots isn ON isn.position_id = bp.id
      WHERE bp.${entityType === "vault" ? "vault_id" : "borrower_id"} = $1
      GROUP BY bp.id, m.name, m.market_id, bp.current_debt, bp.status
      ORDER BY total_reimbursable DESC
    `;

    const result = await pool.query(query, [entityId]);

    return result.rows.map((row) => ({
      marketName: row.market_name,
      marketId: row.market_id,
      totalInterestAccrued: parseFloat(row.total_interest_accrued || 0),
      totalReimbursable: parseFloat(row.total_reimbursable || 0),
      currentDebt: parseFloat(row.current_debt || 0),
      lastSnapshotDate: row.last_snapshot_date
        ? row.last_snapshot_date.toISOString()
        : null,
      status: row.status,
    }));
  }

  private async getReimbursementStats(
    entityId: number,
    entityType: "vault" | "borrower"
  ) {
    const query = `
      SELECT 
        COUNT(CASE WHEN r.status = 'pending' THEN 1 END) as pending_count,
        COUNT(CASE WHEN r.status = 'completed' THEN 1 END) as completed_count,
        COUNT(CASE WHEN r.status = 'failed' THEN 1 END) as failed_count,
        COALESCE(SUM(CASE WHEN r.status = 'pending' THEN r.amount ELSE 0 END), 0) as total_pending,
        COALESCE(SUM(CASE WHEN r.status = 'completed' THEN r.amount ELSE 0 END), 0) as total_completed
      FROM reimbursements r
      JOIN borrower_positions bp ON r.position_id = bp.id
      WHERE bp.${entityType === "vault" ? "vault_id" : "borrower_id"} = $1
    `;

    const result = await pool.query(query, [entityId]);
    const row = result.rows[0];

    return {
      pendingCount: parseInt(row.pending_count || 0),
      completedCount: parseInt(row.completed_count || 0),
      failedCount: parseInt(row.failed_count || 0),
      totalPending: parseFloat(row.total_pending || 0),
      totalCompleted: parseFloat(row.total_completed || 0),
    };
  }

  // ==================== PROCESSING METHODS ====================

  /**
   * Create reimbursement entries for positions that have accumulated interest above cap
   */
  async createReimbursementEntries(date: Date = new Date()): Promise<number> {
    const client = await pool.connect();
    let createdCount = 0;

    try {
      await client.query("BEGIN");

      const positionsNeedingReimbursement = await client.query(
        `
        SELECT 
          i.position_id,
          i.interest_above_cap,
          i.snapshot_date,
          bp.current_debt,
          m.name as market_name,
          COALESCE(v.name, b.address) as entity_identifier
        FROM interest_snapshots i
        JOIN borrower_positions bp ON bp.id = i.position_id
        JOIN markets m ON m.market_id = bp.market_id
        LEFT JOIN vaults v ON v.id = bp.vault_id
        LEFT JOIN borrowers b ON b.id = bp.borrower_id
        WHERE i.snapshot_date = $1::date
          AND i.interest_above_cap > 0
          AND bp.status = 'active'
        `,
        [date]
      );

      console.log(
        `\n📋 Found ${
          positionsNeedingReimbursement.rows.length
        } positions needing reimbursement for ${
          date.toISOString().split("T")[0]
        }`
      );

      for (const position of positionsNeedingReimbursement.rows) {
        const existing = await client.query(
          `
          SELECT id FROM reimbursements
          WHERE position_id = $1 
            AND period_start = $2
            AND period_end = $2
          `,
          [position.position_id, position.snapshot_date]
        );

        if (existing.rows.length > 0) {
          console.log(
            `  ⏭️  Reimbursement already exists for position ${position.position_id}`
          );
          continue;
        }

        await client.query(
          `
          INSERT INTO reimbursements (
            position_id,
            amount,
            period_start,
            period_end,
            status,
            created_at
          ) VALUES ($1, $2, $3, $4, $5, NOW())
          `,
          [
            position.position_id,
            position.interest_above_cap,
            position.snapshot_date,
            position.snapshot_date,
            "pending",
          ]
        );

        createdCount++;
        console.log(
          `  ✅ Created reimbursement for ${position.entity_identifier} in ${
            position.market_name
          }: ${parseFloat(position.interest_above_cap).toFixed(6)} tokens`
        );
      }

      await client.query("COMMIT");
      console.log(`\n✅ Created ${createdCount} new reimbursement entries\n`);

      return createdCount;
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Error creating reimbursement entries:", error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Process pending reimbursements (simulate payment)
   */
  async processPendingReimbursements(limit: number = 10): Promise<{
    processed: number;
    failed: number;
    totalAmount: number;
  }> {
    const client = await pool.connect();
    let processed = 0;
    let failed = 0;
    let totalAmount = 0;

    try {
      await client.query("BEGIN");

      const pendingReimbursements = await client.query(
        `
        SELECT 
          r.id,
          r.position_id,
          r.amount,
          r.period_start,
          r.period_end,
          COALESCE(v.address, b.address) as recipient_address,
          COALESCE(v.name, 'Direct Borrower') as entity_name,
          m.name as market_name
        FROM reimbursements r
        JOIN borrower_positions bp ON bp.id = r.position_id
        JOIN markets m ON m.market_id = bp.market_id
        LEFT JOIN vaults v ON v.id = bp.vault_id
        LEFT JOIN borrowers b ON b.id = bp.borrower_id
        WHERE r.status = 'pending'
        ORDER BY r.created_at ASC
        LIMIT $1
        `,
        [limit]
      );

      console.log(
        `\n💰 Processing ${pendingReimbursements.rows.length} pending reimbursements...\n`
      );

      for (const reimbursement of pendingReimbursements.rows) {
        try {
          // SIMULATE: In production, call smart contract
          const txHash = await this.simulatePayment(
            reimbursement.recipient_address,
            reimbursement.amount
          );

          await client.query(
            `
            UPDATE reimbursements
            SET status = 'completed',
                tx_hash = $1,
                processed_at = NOW()
            WHERE id = $2
            `,
            [txHash, reimbursement.id]
          );

          processed++;
          totalAmount += parseFloat(reimbursement.amount);

          console.log(
            `  ✅ Processed reimbursement #${reimbursement.id}: ${parseFloat(
              reimbursement.amount
            ).toFixed(6)} tokens to ${reimbursement.entity_name}`
          );
          console.log(`     TX Hash: ${txHash}`);
        } catch (error) {
          await client.query(
            `
            UPDATE reimbursements
            SET status = 'failed',
                processed_at = NOW()
            WHERE id = $1
            `,
            [reimbursement.id]
          );

          failed++;
          console.error(
            `  ❌ Failed to process reimbursement #${reimbursement.id}:`,
            error
          );
        }
      }

      await client.query("COMMIT");

      console.log(`\n✅ Summary:`);
      console.log(`   - Processed: ${processed}`);
      console.log(`   - Failed: ${failed}`);
      console.log(`   - Total Amount: ${totalAmount.toFixed(6)} tokens\n`);

      return { processed, failed, totalAmount };
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Error processing reimbursements:", error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get reimbursement statistics
   */
  async getStats(): Promise<{
    pending: { count: number; totalAmount: number };
    completed: { count: number; totalAmount: number };
    failed: { count: number; totalAmount: number };
  }> {
    const result = await pool.query(`
      SELECT 
        status,
        COUNT(*) as count,
        COALESCE(SUM(amount), 0) as total_amount
      FROM reimbursements
      GROUP BY status
    `);

    const stats = {
      pending: { count: 0, totalAmount: 0 },
      completed: { count: 0, totalAmount: 0 },
      failed: { count: 0, totalAmount: 0 },
    };

    result.rows.forEach((row) => {
      const status = row.status as "pending" | "completed" | "failed";
      stats[status] = {
        count: parseInt(row.count),
        totalAmount: parseFloat(row.total_amount),
      };
    });

    return stats;
  }

  /**
   * Retry failed reimbursements
   */
  async retryFailedReimbursements(limit: number = 5): Promise<number> {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const result = await client.query(
        `
        UPDATE reimbursements
        SET status = 'pending',
            tx_hash = NULL,
            processed_at = NULL
        WHERE status = 'failed'
          AND id IN (
            SELECT id FROM reimbursements
            WHERE status = 'failed'
            ORDER BY created_at DESC
            LIMIT $1
          )
        RETURNING id
        `,
        [limit]
      );

      await client.query("COMMIT");

      const retryCount = result.rows.length;
      console.log(`🔄 Reset ${retryCount} failed reimbursements to pending`);

      return retryCount;
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Error retrying failed reimbursements:", error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Simulate payment processing (placeholder for smart contract call)
   */
  private async simulatePayment(
    recipientAddress: string,
    amount: string
  ): Promise<string> {
    await new Promise((resolve) => setTimeout(resolve, 100));

    if (Math.random() < 0.95) {
      const fakeHash =
        "0x" +
        Array.from({ length: 64 }, () =>
          Math.floor(Math.random() * 16).toString(16)
        ).join("");
      return fakeHash;
    } else {
      throw new Error("Simulated payment failure");
    }
  }
}

export const reimbursementService = new ReimbursementService();
