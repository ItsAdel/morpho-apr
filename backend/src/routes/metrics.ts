import { Router } from "express";
import { pool } from "../config/database";
import { VaultSupplyService } from "../services/vaultSupplyService";

export const metricsRouter = Router();
const vaultSupplyService = new VaultSupplyService();

// Get enhanced dashboard metrics with borrower breakdown
metricsRouter.get("/dashboard", async (req, res) => {
  try {
    // Total active borrowers (real users, not vaults)
    const realBorrowersResult = await pool.query(`
      SELECT COUNT(DISTINCT id) as count
      FROM borrower_positions
      WHERE status = 'active' AND borrower_id IS NOT NULL
    `);

    // Total active vaults
    const vaultsResult = await pool.query(`
      SELECT COUNT(DISTINCT id) as count
      FROM borrower_positions
      WHERE status = 'active' AND vault_id IS NOT NULL
    `);

    // Total active positions (all)
    const borrowersResult = await pool.query(`
      SELECT COUNT(DISTINCT id) as count
      FROM borrower_positions
      WHERE status = 'active'
    `);

    // Positions above/below cap based on latest snapshots
    const rateBreakdown = await pool.query(`
      SELECT 
        COUNT(CASE WHEN i.current_rate > m.apr_cap THEN 1 END) as above_cap,
        COUNT(CASE WHEN i.current_rate <= m.apr_cap THEN 1 END) as below_cap
      FROM (
        SELECT DISTINCT ON (position_id) 
          position_id, current_rate
        FROM interest_snapshots
        ORDER BY position_id, snapshot_date DESC
      ) i
      JOIN borrower_positions bp ON bp.id = i.position_id
      JOIN markets m ON m.market_id = bp.market_id
      WHERE bp.status = 'active'
    `);

    // Daily reimbursed amount (today)
    const dailyReimbursement = await pool.query(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM reimbursements
      WHERE DATE(created_at) = CURRENT_DATE
    `);

    // Market breakdown
    const marketBreakdown = await pool.query(`
      SELECT 
        m.name,
        m.market_id,
        COUNT(bp.id) as active_positions,
        COALESCE(SUM(r.amount), 0) as total_reimbursed
      FROM markets m
      LEFT JOIN borrower_positions bp ON bp.market_id = m.market_id AND bp.status = 'active'
      LEFT JOIN reimbursements r ON r.position_id = bp.id 
        AND r.created_at >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY m.id, m.name, m.market_id
    `);

    // Breakdown by entity type (above/below cap)
    const entityBreakdown = await pool.query(`
      SELECT 
        CASE 
          WHEN bp.borrower_id IS NOT NULL THEN 'borrower'
          WHEN bp.vault_id IS NOT NULL THEN 'vault'
        END as entity_type,
        COUNT(CASE WHEN i.current_rate > m.apr_cap THEN 1 END) as above_cap,
        COUNT(CASE WHEN i.current_rate <= m.apr_cap THEN 1 END) as below_cap
      FROM (
        SELECT DISTINCT ON (position_id) 
          position_id, current_rate
        FROM interest_snapshots
        ORDER BY position_id, snapshot_date DESC
      ) i
      JOIN borrower_positions bp ON bp.id = i.position_id
      JOIN markets m ON m.market_id = bp.market_id
      WHERE bp.status = 'active'
      GROUP BY entity_type
    `);

    const borrowerBreakdown = entityBreakdown.rows.find(
      (r) => r.entity_type === "borrower"
    ) || { above_cap: 0, below_cap: 0 };
    const vaultBreakdown = entityBreakdown.rows.find(
      (r) => r.entity_type === "vault"
    ) || { above_cap: 0, below_cap: 0 };

    // Get vault supply stats (Company's earnings)
    const vaultSupplyStats = await vaultSupplyService.getVaultSupplyStats();
    const totalVaultInterestEarned = vaultSupplyStats.reduce(
      (sum, v) => sum + parseFloat(v.total_interest_earned || "0"),
      0
    );
    const totalVaultReimbursable = vaultSupplyStats.reduce(
      (sum, v) => sum + parseFloat(v.total_reimbursable || "0"),
      0
    );

    res.json({
      totalActiveBorrowers: borrowersResult.rows[0].count,
      realBorrowers: realBorrowersResult.rows[0].count,
      activeVaults: vaultsResult.rows[0].count,
      borrowersAboveCap: rateBreakdown.rows[0].above_cap || 0,
      borrowersBelowCap: rateBreakdown.rows[0].below_cap || 0,
      realBorrowersAboveCap: borrowerBreakdown.above_cap || 0,
      realBorrowersBelowCap: borrowerBreakdown.below_cap || 0,
      vaultsAboveCap: vaultBreakdown.above_cap || 0,
      vaultsBelowCap: vaultBreakdown.below_cap || 0,
      dailyReimbursedUSD: dailyReimbursement.rows[0].total,
      vaultSupplyInterest: totalVaultInterestEarned,
      vaultSupplyAboveCap: totalVaultReimbursable,
      vaultStats: vaultSupplyStats,
      marketBreakdown: marketBreakdown.rows,
    });
  } catch (error: any) {
    console.error("Dashboard metrics error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get alerts (rates > 2x cap)
metricsRouter.get("/alerts", async (req, res) => {
  try {
    const alerts = await pool.query(`
      SELECT 
        m.name as market_name,
        i.current_rate,
        m.apr_cap,
        (i.current_rate / m.apr_cap) as rate_multiplier
      FROM (
        SELECT DISTINCT ON (position_id) *
        FROM interest_snapshots
        ORDER BY position_id, snapshot_date DESC
      ) i
      JOIN borrower_positions bp ON bp.id = i.position_id
      JOIN markets m ON m.market_id = bp.market_id
      WHERE i.current_rate > (m.apr_cap * 2)
        AND bp.status = 'active'
    `);

    res.json({ alerts: alerts.rows });
  } catch (error: any) {
    console.error("Alerts error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get real borrowers list with basic info
metricsRouter.get("/borrowers", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const borrowers = await pool.query(
      `
      SELECT 
        b.address,
        COUNT(bp.id) as position_count,
        SUM(bp.current_debt) as total_debt,
        MAX(i.current_rate) as max_rate,
        MAX(m.apr_cap) as max_cap,
        BOOL_OR(i.current_rate > m.apr_cap) as has_position_above_cap
      FROM borrowers b
      JOIN borrower_positions bp ON bp.borrower_id = b.id
      LEFT JOIN (
        SELECT DISTINCT ON (position_id) *
        FROM interest_snapshots
        ORDER BY position_id, snapshot_date DESC
      ) i ON i.position_id = bp.id
      LEFT JOIN markets m ON m.market_id = bp.market_id
      WHERE bp.status = 'active'
      GROUP BY b.id, b.address
      ORDER BY total_debt DESC NULLS LAST
      LIMIT $1 OFFSET $2
    `,
      [limit, offset]
    );

    const countResult = await pool.query(`
      SELECT COUNT(DISTINCT b.id) as total
      FROM borrowers b
      JOIN borrower_positions bp ON bp.borrower_id = b.id
      WHERE bp.status = 'active'
    `);

    res.json({
      borrowers: borrowers.rows,
      total: countResult.rows[0].total,
      limit,
      offset,
    });
  } catch (error: any) {
    console.error("Borrowers list error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get positions above cap (but not necessarily critical)
metricsRouter.get("/above-cap", async (req, res) => {
  try {
    const positions = await pool.query(`
      SELECT 
        m.name as market_name,
        COALESCE(v.address, b.address) as borrower_address,
        COALESCE(v.name, 'Direct Borrower') as entity_name,
        bp.current_debt,
        i.current_rate,
        m.apr_cap,
        (i.current_rate / m.apr_cap) as rate_multiplier,
        (i.current_rate - m.apr_cap) as excess_rate,
        i.snapshot_date
      FROM (
        SELECT DISTINCT ON (position_id) *
        FROM interest_snapshots
        ORDER BY position_id, snapshot_date DESC
      ) i
      JOIN borrower_positions bp ON bp.id = i.position_id
      JOIN markets m ON m.market_id = bp.market_id
      LEFT JOIN vaults v ON v.id = bp.vault_id
      LEFT JOIN borrowers b ON b.id = bp.borrower_id
      WHERE i.current_rate > m.apr_cap
        AND bp.status = 'active'
      ORDER BY rate_multiplier DESC
    `);

    res.json({ positions: positions.rows });
  } catch (error: any) {
    console.error("Above cap positions error:", error);
    res.status(500).json({ error: error.message });
  }
});
