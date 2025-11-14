import * as dotenv from "dotenv";
import { InterestService } from "../services/interestService";
import { VaultSupplyService } from "../services/vaultSupplyService";
import { pool } from "../config/database";

dotenv.config();

/**
 * Daily job to process:
 * 1. Vault supply interest (Company's earnings)
 * 2. Borrower debt interest
 * 3. Create reimbursements where needed
 */
async function runDailyInterestJob() {
  console.log("=".repeat(60));
  console.log(`📅 Daily Interest Processing Job`);
  console.log(`⏰ Started at: ${new Date().toISOString()}`);
  console.log("=".repeat(60));
  console.log();

  try {
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
        `     Above Cap: ${parseFloat(token.total_above_cap || 0).toFixed(6)} ${
          token.loan_asset
        }`
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

    console.log("\n" + "=".repeat(60));
    console.log("✅ Daily job completed successfully!");
    console.log("=".repeat(60));

    process.exit(0);
  } catch (error: any) {
    console.error("\n❌ Daily job failed:");
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the job
runDailyInterestJob();
