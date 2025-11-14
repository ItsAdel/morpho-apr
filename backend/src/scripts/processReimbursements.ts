/**
 * Script to process reimbursements
 * This simulates the complete reimbursement workflow:
 * 1. Show pending reimbursements
 * 2. Process them (simulate payment)
 * 3. Show statistics
 */

import * as dotenv from "dotenv";
import { reimbursementService } from "../services/reimbursementService";
import { pool } from "../config/database";

dotenv.config();

async function main() {
  console.log("=".repeat(70));
  console.log("         Company's APR REIMBURSEMENT PROCESSOR");
  console.log("=".repeat(70));
  console.log("\n");

  try {
    // Test database connection
    await pool.query("SELECT NOW()");
    console.log("✅ Connected to PostgreSQL database\n");

    // 1. Show current statistics
    console.log("📊 Current Reimbursement Statistics:");
    console.log("-".repeat(70));
    const statsBefore = await reimbursementService.getStats();
    console.log(
      `   Pending:   ${
        statsBefore.pending.count
      } reimbursements (${statsBefore.pending.totalAmount.toFixed(6)} tokens)`
    );
    console.log(
      `   Completed: ${
        statsBefore.completed.count
      } reimbursements (${statsBefore.completed.totalAmount.toFixed(6)} tokens)`
    );
    console.log(
      `   Failed:    ${
        statsBefore.failed.count
      } reimbursements (${statsBefore.failed.totalAmount.toFixed(6)} tokens)`
    );
    console.log("\n");

    if (statsBefore.pending.count === 0) {
      console.log("ℹ️  No pending reimbursements to process.");
      console.log("\nTip: Run the daily interest script first:");
      console.log("     npm run daily:interest\n");
      await cleanup();
      return;
    }

    // 2. Show pending reimbursement details
    await showPendingReimbursements();

    // 3. Ask user confirmation (in production, this would be automated)
    console.log("\n" + "=".repeat(70));
    console.log("🚀 Processing pending reimbursements...");
    console.log("=".repeat(70));

    // 4. Process reimbursements
    const result = await reimbursementService.processPendingReimbursements(10);

    // 5. Show updated statistics
    console.log("\n" + "=".repeat(70));
    console.log("📊 Updated Reimbursement Statistics:");
    console.log("-".repeat(70));
    const statsAfter = await reimbursementService.getStats();
    console.log(
      `   Pending:   ${
        statsAfter.pending.count
      } reimbursements (${statsAfter.pending.totalAmount.toFixed(6)} tokens)`
    );
    console.log(
      `   Completed: ${
        statsAfter.completed.count
      } reimbursements (${statsAfter.completed.totalAmount.toFixed(6)} tokens)`
    );
    console.log(
      `   Failed:    ${
        statsAfter.failed.count
      } reimbursements (${statsAfter.failed.totalAmount.toFixed(6)} tokens)`
    );
    console.log("\n");

    // 6. Show what changed
    console.log("=".repeat(70));
    console.log("✅ Processing Summary:");
    console.log("-".repeat(70));
    console.log(`   ✅ Processed: ${result.processed} reimbursements`);
    console.log(`   ❌ Failed: ${result.failed} reimbursements`);
    console.log(`   💰 Total Amount: ${result.totalAmount.toFixed(6)} tokens`);
    console.log("\n");

    // 7. If there are failed reimbursements, offer to retry
    if (statsAfter.failed.count > 0) {
      console.log("⚠️  There are failed reimbursements.");
      console.log("   You can retry them with: npm run process:retry-failed\n");
    }

    console.log("✅ Reimbursement processing complete!\n");
  } catch (error: any) {
    console.error("\n❌ Error:", error.message);
    console.error(error);
  } finally {
    await cleanup();
  }
}

async function showPendingReimbursements() {
  console.log("💰 Pending Reimbursements:");
  console.log("-".repeat(70));

  const result = await pool.query(`
    SELECT 
      r.id,
      r.amount,
      r.period_start,
      r.period_end,
      r.created_at,
      COALESCE(v.name, 'Direct Borrower') as entity_name,
      COALESCE(v.address, b.address) as recipient_address,
      m.name as market_name
    FROM reimbursements r
    JOIN borrower_positions bp ON bp.id = r.position_id
    JOIN markets m ON m.market_id = bp.market_id
    LEFT JOIN vaults v ON v.id = bp.vault_id
    LEFT JOIN borrowers b ON b.id = bp.borrower_id
    WHERE r.status = 'pending'
    ORDER BY r.created_at ASC
    LIMIT 20
  `);

  if (result.rows.length === 0) {
    console.log("   (none)");
  } else {
    result.rows.forEach((row, index) => {
      console.log(`   ${index + 1}. ID: ${row.id}`);
      console.log(`      Entity: ${row.entity_name}`);
      console.log(`      Market: ${row.market_name}`);
      console.log(`      Amount: ${parseFloat(row.amount).toFixed(6)} tokens`);
      console.log(
        `      Period: ${row.period_start.toISOString().split("T")[0]}`
      );
      console.log(
        `      Created: ${row.created_at.toISOString().split("T")[0]}`
      );
      console.log("");
    });
  }
}

async function cleanup() {
  await pool.end();
  console.log("👋 Disconnected from database");
}

// Run the script
main();
