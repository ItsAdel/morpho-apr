/**
 * Service to track vault supply interest
 * Vaults are Company-owned entities that supply liquidity to markets
 * They earn interest on supplied capital
 * Interest earned above cap needs to be reimbursed to borrowers
 */

import { pool } from "../config/database";
import { MorphoService } from "./morphoService";

export class VaultSupplyService {
  private morphoService: MorphoService;

  constructor() {
    this.morphoService = new MorphoService(process.env.POLYGON_RPC_URL!);
  }

  /**
   * Process daily supply interest snapshots for all vault allocations
   */
  async processDailySupplySnapshots() {
    console.log("🏦 Processing vault supply interest snapshots...\n");

    try {
      // Get all vault allocations
      const allocations = await this.getActiveVaultAllocations();
      console.log(`Found ${allocations.length} vault allocations`);

      if (allocations.length === 0) {
        console.log("No vault allocations to process");
        return;
      }

      let processedCount = 0;

      for (const allocation of allocations) {
        try {
          await this.processAllocation(allocation);
          processedCount++;
        } catch (error: any) {
          console.error(
            `❌ Error processing allocation vault=${allocation.vault_name} market=${allocation.market_name}:`,
            error.message
          );
        }
      }

      console.log(
        `\n✅ Processed ${processedCount}/${allocations.length} vault allocations\n`
      );

      // Show summary
      const summary = await this.getTodaySummary();
      console.log("📊 Vault Supply Interest Summary:");
      console.log("-".repeat(60));
      console.log(
        `   Allocations Processed: ${summary.overall.allocations_processed}`
      );

      // Show breakdown by token
      summary.byToken.forEach((token: any) => {
        console.log(`   ${token.loan_asset}:`);
        console.log(
          `     Interest Earned: ${parseFloat(
            token.total_interest_earned || "0"
          ).toFixed(6)} ${token.loan_asset}`
        );
        console.log(
          `     Above Cap: ${parseFloat(token.total_above_cap || "0").toFixed(
            6
          )} ${token.loan_asset}`
        );
      });

      console.log(
        `   Avg Supply APY: ${(
          (summary.overall.avg_supply_apy || 0) * 100
        ).toFixed(2)}%`
      );
      console.log("-".repeat(60));
    } catch (error: any) {
      console.error(
        "❌ Fatal error in processDailySupplySnapshots:",
        error.message
      );
      throw error;
    }
  }

  /**
   * Process a single vault allocation
   */
  private async processAllocation(allocation: any) {
    // Get current market state from Morpho
    const marketData = await this.morphoService.getMarketState(
      allocation.market_id
    );

    if (!marketData || !marketData.state) {
      console.warn(
        `⚠️  No market data for ${allocation.market_name}, vault ${allocation.vault_name}`
      );
      return;
    }

    const currentSupplyApy = parseFloat(marketData.state.supplyApy);
    const cappedApy = parseFloat(allocation.apr_cap);
    const supplyAmount = parseFloat(allocation.supply_assets);

    // Calculate daily interest (APY to daily rate)
    const dailyRate = currentSupplyApy / 365;
    const interestEarned = supplyAmount * dailyRate;

    // Calculate interest above cap
    const cappedDailyRate = cappedApy / 365;
    const cappedInterest = supplyAmount * cappedDailyRate;
    const interestAboveCap = Math.max(0, interestEarned - cappedInterest);

    // Save snapshot
    await this.saveSupplySnapshot({
      vault_id: allocation.vault_id,
      market_id: allocation.market_id,
      snapshot_date: new Date(),
      supply_amount: supplyAmount,
      supply_apy: currentSupplyApy,
      capped_apy: cappedApy,
      interest_earned: interestEarned,
      interest_above_cap: interestAboveCap,
      loan_asset: allocation.loan_asset,
    });

    console.log(
      `  ✅ ${allocation.vault_name} in ${
        allocation.market_name
      }: ${interestEarned.toFixed(6)} earned, ${interestAboveCap.toFixed(
        6
      )} above cap`
    );
  }

  /**
   * Get all active vault allocations with market info
   */
  private async getActiveVaultAllocations() {
    const result = await pool.query(`
      SELECT 
        va.vault_id,
        va.market_id,
        va.supply_assets,
        v.name as vault_name,
        v.address as vault_address,
        m.name as market_name,
        m.apr_cap,
        m.loan_asset
      FROM vault_allocations va
      JOIN vaults v ON v.id = va.vault_id
      JOIN markets m ON m.market_id = va.market_id
      WHERE va.supply_assets > 0
      ORDER BY v.name, m.name
    `);
    return result.rows;
  }

  /**
   * Save daily supply interest snapshot
   */
  private async saveSupplySnapshot(data: any) {
    await pool.query(
      `
      INSERT INTO vault_supply_snapshots 
      (vault_id, market_id, snapshot_date, supply_amount, supply_apy, capped_apy, interest_earned, interest_above_cap, loan_asset)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (vault_id, market_id, snapshot_date) 
      DO UPDATE SET
        supply_amount = $4,
        supply_apy = $5,
        capped_apy = $6,
        interest_earned = $7,
        interest_above_cap = $8,
        loan_asset = $9
    `,
      [
        data.vault_id,
        data.market_id,
        data.snapshot_date,
        data.supply_amount,
        data.supply_apy,
        data.capped_apy,
        data.interest_earned,
        data.interest_above_cap,
        data.loan_asset,
      ]
    );
  }

  /**
   * Get summary of today's processing (by token)
   */
  async getTodaySummary() {
    const result = await pool.query(`
      SELECT 
        loan_asset,
        COUNT(*) as allocations_processed,
        SUM(interest_earned) as total_interest_earned,
        SUM(interest_above_cap) as total_above_cap,
        AVG(supply_apy) as avg_supply_apy
      FROM vault_supply_snapshots
      WHERE DATE(snapshot_date) = CURRENT_DATE
      GROUP BY loan_asset
      ORDER BY loan_asset
    `);

    // Return both individual tokens and overall summary
    return {
      byToken: result.rows,
      overall: {
        allocations_processed: result.rows.reduce(
          (sum, r) => sum + parseInt(r.allocations_processed),
          0
        ),
        total_interest_earned: result.rows.reduce(
          (sum, r) => sum + parseFloat(r.total_interest_earned || 0),
          0
        ),
        total_above_cap: result.rows.reduce(
          (sum, r) => sum + parseFloat(r.total_above_cap || 0),
          0
        ),
        avg_supply_apy:
          result.rows.reduce(
            (sum, r) => sum + parseFloat(r.avg_supply_apy || 0),
            0
          ) / (result.rows.length || 1),
      },
    };
  }

  /**
   * Get vault supply stats for dashboard
   */
  async getVaultSupplyStats() {
    const result = await pool.query(`
      SELECT 
        v.name as vault_name,
        v.address as vault_address,
        COUNT(DISTINCT vss.market_id) as markets_count,
        SUM(vss.supply_amount) as total_supplied,
        SUM(vss.interest_earned) as total_interest_earned,
        SUM(vss.interest_above_cap) as total_reimbursable,
        AVG(vss.supply_apy) as avg_supply_apy
      FROM vaults v
      LEFT JOIN vault_supply_snapshots vss ON vss.vault_id = v.id
        AND DATE(vss.snapshot_date) = CURRENT_DATE
      GROUP BY v.id, v.name, v.address
      ORDER BY v.name
    `);
    return result.rows;
  }
}
