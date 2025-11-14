/**
 * Cleanup database to keep only the 3 target markets and their data
 */

import * as dotenv from "dotenv";
import { pool } from "../config/database";

dotenv.config();

const TARGET_MARKETS = [
  {
    id: "0xb8ae474af3b91c8143303723618b31683b52e9c86566aa54c06f0bc27906bcae",
    name: "wstETH/WETH 91.5% LLTV",
  },
  {
    id: "0x1cfe584af3db05c7f39d60e458a87a8b2f6b5d8c6125631984ec489f1d13553b",
    name: "WBTC/USDC 86% LLTV",
  },
  {
    id: "0x7506b33817b57f686e37b87b5d4c5c93fdef4cffd21bbf9291f18b2f29ab0550",
    name: "WPOL/USDC 77% LLTV",
  },
];

const TARGET_VAULTS = [
  {
    address: "0xF5C81d25ee174d83f1FD202cA94AE6070d073cCF",
    name: "Compound WETH",
  },
  {
    address: "0xfD06859A671C21497a2EB8C5E3fEA48De924D6c8",
    name: "Compound USDT",
  },
  {
    address: "0xAcB0DCe4b0FF400AD8F6917f3ca13E434C9ed6bC",
    name: "Steakhouse High Yield USDC",
  },
];

async function main() {
  console.log("=".repeat(70));
  console.log("         DATABASE CLEANUP - KEEP ONLY TARGET MARKETS");
  console.log("=".repeat(70));
  console.log("\n");

  try {
    await pool.query("SELECT NOW()");
    console.log("✅ Connected to PostgreSQL database\n");

    const targetMarketIds = TARGET_MARKETS.map((m) => m.id);
    const targetVaultAddresses = TARGET_VAULTS.map((v) => v.address);

    // 1. Delete reimbursements for non-target markets
    console.log("🗑️  Deleting reimbursements for non-target markets...");
    const deleteReimbursements = await pool.query(
      `
      DELETE FROM reimbursements
      WHERE position_id IN (
        SELECT id FROM borrower_positions
        WHERE market_id NOT IN ($1, $2, $3)
      )
      `,
      targetMarketIds
    );
    console.log(`   Deleted ${deleteReimbursements.rowCount} reimbursements\n`);

    // 2. Delete interest snapshots for non-target markets
    console.log("🗑️  Deleting interest snapshots for non-target markets...");
    const deleteSnapshots = await pool.query(
      `
      DELETE FROM interest_snapshots
      WHERE position_id IN (
        SELECT id FROM borrower_positions
        WHERE market_id NOT IN ($1, $2, $3)
      )
      `,
      targetMarketIds
    );
    console.log(`   Deleted ${deleteSnapshots.rowCount} snapshots\n`);

    // 3. Delete borrower positions for non-target markets
    console.log("🗑️  Deleting borrower positions for non-target markets...");
    const deletePositions = await pool.query(
      `
      DELETE FROM borrower_positions
      WHERE market_id NOT IN ($1, $2, $3)
      `,
      targetMarketIds
    );
    console.log(`   Deleted ${deletePositions.rowCount} positions\n`);

    // 4. Delete vault positions from borrower_positions (vaults are NOT borrowers!)
    console.log("🗑️  Removing vaults from borrower_positions table...");

    // First delete their interest snapshots
    const deleteVaultSnapshots = await pool.query(
      `
      DELETE FROM interest_snapshots
      WHERE position_id IN (
        SELECT id FROM borrower_positions
        WHERE vault_id IS NOT NULL
      )
      `
    );
    console.log(
      `   Deleted ${deleteVaultSnapshots.rowCount} vault interest snapshots`
    );

    // Then delete their reimbursements
    const deleteVaultReimbursements = await pool.query(
      `
      DELETE FROM reimbursements
      WHERE position_id IN (
        SELECT id FROM borrower_positions
        WHERE vault_id IS NOT NULL
      )
      `
    );
    console.log(
      `   Deleted ${deleteVaultReimbursements.rowCount} vault reimbursements`
    );

    // Finally delete vault positions
    const deleteVaultPositions = await pool.query(
      `
      DELETE FROM borrower_positions
      WHERE vault_id IS NOT NULL
      `
    );
    console.log(
      `   Deleted ${deleteVaultPositions.rowCount} vault positions (vaults are suppliers, not borrowers!)\n`
    );

    // 5. Delete vault allocations for non-target markets
    console.log("🗑️  Deleting vault allocations for non-target markets...");
    const deleteAllocations = await pool.query(
      `
      DELETE FROM vault_allocations
      WHERE market_id NOT IN ($1, $2, $3)
      `,
      targetMarketIds
    );
    console.log(`   Deleted ${deleteAllocations.rowCount} allocations\n`);

    // 6. Delete non-target vaults
    console.log("🗑️  Deleting non-target vaults...");
    const deleteVaults = await pool.query(
      `
      DELETE FROM vaults
      WHERE address NOT IN ($1, $2, $3)
      `,
      targetVaultAddresses
    );
    console.log(`   Deleted ${deleteVaults.rowCount} vaults\n`);

    // 7. Delete non-target markets
    console.log("🗑️  Deleting non-target markets...");
    const deleteMarkets = await pool.query(
      `
      DELETE FROM markets
      WHERE market_id NOT IN ($1, $2, $3)
      `,
      targetMarketIds
    );
    console.log(`   Deleted ${deleteMarkets.rowCount} markets\n`);

    // 8. Delete orphaned borrowers (no positions left)
    console.log("🗑️  Deleting orphaned borrowers (no positions)...");
    const deleteOrphans = await pool.query(
      `
      DELETE FROM borrowers
      WHERE id NOT IN (
        SELECT DISTINCT borrower_id FROM borrower_positions
        WHERE borrower_id IS NOT NULL
      )
      `
    );
    console.log(`   Deleted ${deleteOrphans.rowCount} orphaned borrowers\n`);

    console.log("=".repeat(70));
    console.log("✅ CLEANUP COMPLETE");
    console.log("=".repeat(70));

    // Show summary
    const marketSummary = await pool.query(`
      SELECT market_id, name FROM markets ORDER BY name
    `);

    const vaultSummary = await pool.query(`
      SELECT address, name FROM vaults ORDER BY name
    `);

    const borrowerCount = await pool.query(`
      SELECT COUNT(*) as count FROM borrowers
    `);

    const positionCount = await pool.query(`
      SELECT COUNT(*) as count FROM borrower_positions
    `);

    console.log("\n📊 REMAINING DATA:");
    console.log("-".repeat(70));
    console.log(`\n🏦 Markets (${marketSummary.rows.length}):`);
    marketSummary.rows.forEach((m) => {
      console.log(`   - ${m.name}`);
      console.log(`     ${m.market_id}`);
    });

    console.log(`\n🏛️  Vaults (${vaultSummary.rows.length}):`);
    vaultSummary.rows.forEach((v) => {
      console.log(`   - ${v.name}`);
      console.log(`     ${v.address}`);
    });

    console.log(
      `\n👥 Borrowers: ${borrowerCount.rows[0].count} with ${positionCount.rows[0].count} active positions\n`
    );
  } catch (error: any) {
    console.error("\n❌ Error:", error.message);
    console.error(error);
  } finally {
    await pool.end();
    console.log("👋 Disconnected from database");
  }
}

main();
