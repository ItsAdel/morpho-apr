import { pool } from "../config/database";
import { MorphoService } from "./morphoService";

export class InterestService {
  private morphoService: MorphoService;

  constructor() {
    this.morphoService = new MorphoService(process.env.POLYGON_RPC_URL!);
  }

  /**
   * Main method: Process daily interest snapshots for all active positions
   */
  async processDailySnapshot() {
    console.log("🔄 Processing daily interest snapshots...\n");

    try {
      // 1. Fetch all active borrower positions
      const positions = await this.getActivePositions();
      console.log(`Found ${positions.length} active positions`);

      if (positions.length === 0) {
        console.log("No active positions to process");
        return;
      }

      let processedCount = 0;
      let reimbursementsCreated = 0;

      // 2. Process each position
      for (const position of positions) {
        try {
          await this.processPosition(position);
          processedCount++;

          // Check if reimbursement was created
          const hasReimbursement = await this.checkRecentReimbursement(
            position.id
          );
          if (hasReimbursement) reimbursementsCreated++;
        } catch (error: any) {
          console.error(
            `❌ Error processing position ${position.id}:`,
            error.message
          );
        }
      }

      console.log(
        `\n✅ Processed ${processedCount}/${positions.length} positions`
      );
      console.log(`💰 Created ${reimbursementsCreated} reimbursements`);
    } catch (error: any) {
      console.error("❌ Fatal error in processDailySnapshot:", error.message);
      throw error;
    }
  }

  /**
   * Process a single position: fetch rates, calculate interest, create reimbursement
   */
  private async processPosition(position: any) {
    // Get current market rate from Morpho
    const marketData = await this.morphoService.getMarketState(
      position.market_id
    );

    if (!marketData || !marketData.state) {
      console.warn(
        `⚠️  No market data for position ${position.id}, market ${position.market_id}`
      );
      return;
    }

    const currentBorrowApy = parseFloat(marketData.state.borrowApy);
    const cappedRate = await this.getCappedRate(position.market_id);

    // Calculate daily interest (APY to daily rate)
    const dailyRate = currentBorrowApy / 365;
    const interestAccrued = parseFloat(position.current_debt) * dailyRate;

    // Calculate interest above cap
    const cappedDailyRate = cappedRate / 365;
    const cappedInterest = parseFloat(position.current_debt) * cappedDailyRate;
    const interestAboveCap = Math.max(0, interestAccrued - cappedInterest);

    // Save snapshot
    await this.saveInterestSnapshot({
      position_id: position.id,
      snapshot_date: new Date(),
      current_rate: currentBorrowApy,
      capped_rate: cappedRate,
      interest_accrued: interestAccrued,
      interest_above_cap: interestAboveCap,
    });

    // Create reimbursement if needed
    if (interestAboveCap > 0) {
      await this.createReimbursement(position.id, interestAboveCap);
      console.log(
        `  💰 Reimbursement created for position ${
          position.id
        }: ${interestAboveCap.toFixed(6)}`
      );
    }

    // Update position debt
    const newDebt = parseFloat(position.current_debt) + interestAccrued;
    await this.updatePositionDebt(position.id, newDebt);
  }

  /**
   * Get all active borrower positions with market info
   */
  private async getActivePositions() {
    const result = await pool.query(`
      SELECT 
        bp.*,
        m.name as market_name,
        m.apr_cap
      FROM borrower_positions bp
      JOIN markets m ON bp.market_id = m.market_id
      WHERE bp.status = 'active'
      ORDER BY bp.id
    `);
    return result.rows;
  }

  /**
   * Get APR cap for a market
   */
  private async getCappedRate(marketId: string): Promise<number> {
    const result = await pool.query(
      "SELECT apr_cap FROM markets WHERE market_id = $1",
      [marketId]
    );
    return result.rows[0]?.apr_cap || 0.15; // Default 15%
  }

  /**
   * Save daily interest snapshot
   */
  private async saveInterestSnapshot(data: any) {
    await pool.query(
      `
      INSERT INTO interest_snapshots 
      (position_id, snapshot_date, current_rate, capped_rate, interest_accrued, interest_above_cap)
      VALUES ($1, $2, $3, $4, $5, $6)
    `,
      [
        data.position_id,
        data.snapshot_date,
        data.current_rate,
        data.capped_rate,
        data.interest_accrued,
        data.interest_above_cap,
      ]
    );
  }

  /**
   * Create a reimbursement record
   */
  private async createReimbursement(positionId: number, amount: number) {
    await pool.query(
      `
      INSERT INTO reimbursements (position_id, amount, period_start, period_end, status)
      VALUES ($1, $2, CURRENT_DATE - INTERVAL '1 day', CURRENT_DATE, 'pending')
    `,
      [positionId, amount]
    );
  }

  /**
   * Update borrower position debt
   */
  private async updatePositionDebt(positionId: number, newDebt: number) {
    await pool.query(
      `
      UPDATE borrower_positions 
      SET current_debt = $1, updated_at = NOW()
      WHERE id = $2
    `,
      [newDebt, positionId]
    );
  }

  /**
   * Check if a reimbursement was created today for this position
   */
  private async checkRecentReimbursement(positionId: number): Promise<boolean> {
    const result = await pool.query(
      `
      SELECT COUNT(*) as count
      FROM reimbursements
      WHERE position_id = $1 
        AND DATE(created_at) = CURRENT_DATE
    `,
      [positionId]
    );
    return parseInt(result.rows[0].count) > 0;
  }

  /**
   * Get summary of today's processing
   */
  async getTodaySummary() {
    const result = await pool.query(`
      SELECT 
        COUNT(DISTINCT position_id) as positions_processed,
        SUM(interest_accrued) as total_interest,
        SUM(interest_above_cap) as total_reimbursable,
        AVG(current_rate) as avg_rate
      FROM interest_snapshots
      WHERE DATE(snapshot_date) = CURRENT_DATE
    `);
    return result.rows[0];
  }
}
