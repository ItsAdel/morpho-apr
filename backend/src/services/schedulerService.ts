import cron from "node-cron";
import { InterestService } from "./interestService";
import { VaultSupplyService } from "./vaultSupplyService";
import { pool } from "../config/database";

/**
 * Scheduler Service - Manages automated daily jobs
 * Runs interest processing at midnight UTC every day
 */
export class SchedulerService {
  private dailyInterestJob: cron.ScheduledTask | null = null;

  /**
   * Start all scheduled jobs
   */
  start() {
    console.log("🕐 Starting scheduler service...\n");

    // Daily job at midnight UTC
    this.dailyInterestJob = cron.schedule(
      "0 0 * * *",
      async () => {
        console.log("\n🔔 Daily interest job triggered");
        await this.runDailyInterestProcess();
      },
      {
        scheduled: true,
        timezone: "UTC",
      }
    );

    console.log("✅ Scheduler started");
    console.log("📅 Daily interest processing: Every day at 00:00 UTC");

    // Log next execution time
    const nextRun = this.getNextRunTime();
    console.log(`⏰ Next run: ${nextRun}\n`);
  }

  /**
   * Stop all scheduled jobs
   */
  stop() {
    console.log("🛑 Stopping scheduler service...");

    if (this.dailyInterestJob) {
      this.dailyInterestJob.stop();
    }

    console.log("✅ Scheduler stopped");
  }

  /**
   * Run the daily interest processing
   * Processes both vault supply interest and borrower debt interest
   */
  private async runDailyInterestProcess() {
    const startTime = Date.now();

    try {
      console.log("=".repeat(60));
      console.log(`📅 Daily Interest Processing Job`);
      console.log(`⏰ Started at: ${new Date().toISOString()}`);
      console.log("=".repeat(60));
      console.log();

      const interestService = new InterestService();
      const vaultSupplyService = new VaultSupplyService();

      // STEP 1: Process vault supply interest (Company's earnings)
      console.log("🏦 STEP 1: Processing Vault Supply Interest...\n");
      await vaultSupplyService.processDailySupplySnapshots();

      // STEP 2: Process borrower debt interest
      console.log("\n👥 STEP 2: Processing Borrower Debt Interest...\n");
      await interestService.processDailySnapshot();

      // Get summaries
      const vaultSummary = await vaultSupplyService.getTodaySummary();
      const borrowerSummary = await interestService.getTodaySummary();

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      console.log("\n" + "=".repeat(60));
      console.log("📊 DAILY SUMMARY");
      console.log("=".repeat(60));

      console.log("\n🏦 Vault Supply (Company's Earnings):");
      console.log(
        `   Allocations: ${vaultSummary.overall.allocations_processed || 0}`
      );

      // Show by token
      vaultSummary.byToken.forEach((token: any) => {
        console.log(`   ${token.loan_asset}:`);
        console.log(
          `     Interest Earned: ${parseFloat(
            token.total_interest_earned || 0
          ).toFixed(6)} ${token.loan_asset}`
        );
        console.log(
          `     Above Cap: ${parseFloat(token.total_above_cap || 0).toFixed(
            6
          )} ${token.loan_asset}`
        );
      });

      console.log("\n👥 Borrower Debt:");
      console.log(`   Positions: ${borrowerSummary.positions_processed || 0}`);
      console.log(
        `   Interest Accrued: ${parseFloat(
          borrowerSummary.total_interest || 0
        ).toFixed(6)}`
      );
      console.log(
        `   Above Cap (reimbursable): ${parseFloat(
          borrowerSummary.total_reimbursable || 0
        ).toFixed(6)}`
      );

      console.log(`\n⏱️  Duration: ${duration}s`);
      console.log("=".repeat(60));
      console.log("✅ Daily job completed successfully!");
      console.log("=".repeat(60));
    } catch (error: any) {
      console.error("\n❌ Daily job failed:");
      console.error(error.message);

      // In production, you might want to:
      // 1. Send alert to monitoring system
      // 2. Send email notification
      // 3. Log to error tracking service
    }
  }

  /**
   * Get next scheduled run time
   */
  private getNextRunTime(): string {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(0, 0, 0, 0);
    return tomorrow.toISOString();
  }

  /**
   * Manually trigger daily job (for testing)
   */
  async runManually() {
    console.log("🔧 Manually triggering daily job...\n");
    await this.runDailyInterestProcess();
  }
}

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n👋 Received SIGINT, shutting down gracefully...");
  await pool.end();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\n👋 Received SIGTERM, shutting down gracefully...");
  await pool.end();
  process.exit(0);
});
