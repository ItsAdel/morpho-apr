/**
 * Test Script: Update Market APR Cap & Recalculate Interest
 *
 * This script allows you to:
 * 1. View current market caps
 * 2. Update a market's APR cap
 * 3. Recalculate daily interest with the new cap
 * 4. See the impact on reimbursements
 *
 * Usage:
 *   npm run test:cap-update
 */

import * as dotenv from "dotenv";
import { pool } from "../config/database";
import { InterestService } from "../services/interestService";
import { VaultSupplyService } from "../services/vaultSupplyService";
import * as readline from "readline";

dotenv.config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function showCurrentCaps() {
  console.log("\n" + "=".repeat(70));
  console.log("📊 CURRENT MARKET APR CAPS");
  console.log("=".repeat(70) + "\n");

  const markets = await pool.query(`
    SELECT 
      name,
      market_id,
      apr_cap,
      (apr_cap * 100) as apr_cap_percent
    FROM markets
    ORDER BY name
  `);

  markets.rows.forEach((market: any, index: number) => {
    console.log(`${index + 1}. ${market.name}`);
    console.log(`   Market ID: ${market.market_id}`);
    console.log(`   Current APR Cap: ${market.apr_cap_percent}%`);
    console.log("");
  });

  return markets.rows;
}

async function showCurrentStats() {
  console.log("📈 CURRENT INTEREST STATS (Before Cap Update)");
  console.log("-".repeat(70));

  const stats = await pool.query(`
    SELECT 
      m.name,
      COUNT(DISTINCT bp.id) as positions,
      COALESCE(SUM(CASE WHEN i.current_rate > m.apr_cap THEN 1 ELSE 0 END), 0) as above_cap,
      COALESCE(SUM(i.interest_above_cap), 0) as total_reimbursable
    FROM markets m
    LEFT JOIN borrower_positions bp ON bp.market_id = m.market_id AND bp.status = 'active'
    LEFT JOIN (
      SELECT DISTINCT ON (position_id) *
      FROM interest_snapshots
      ORDER BY position_id, snapshot_date DESC
    ) i ON i.position_id = bp.id
    GROUP BY m.id, m.name, m.apr_cap
    ORDER BY m.name
  `);

  stats.rows.forEach((stat: any) => {
    console.log(`\n${stat.name}:`);
    console.log(`  Active Positions: ${stat.positions}`);
    console.log(`  Positions Above Cap: ${stat.above_cap}`);
    console.log(
      `  Total Reimbursable: ${parseFloat(stat.total_reimbursable).toFixed(6)}`
    );
  });

  console.log("\n" + "-".repeat(70) + "\n");
}

async function updateMarketCap(marketId: string, newCapPercent: number) {
  const newCap = newCapPercent / 100; // Convert percentage to decimal

  await pool.query(
    `
    UPDATE markets
    SET apr_cap = $1,
        alert_threshold = $2
    WHERE market_id = $3
    `,
    [newCap, newCap * 2, marketId]
  );

  console.log(`\n✅ Updated market APR cap to ${newCapPercent}%\n`);
}

async function recalculateInterest() {
  console.log("=".repeat(70));
  console.log("🔄 RECALCULATING DAILY INTEREST WITH NEW CAP");
  console.log("=".repeat(70) + "\n");

  const interestService = new InterestService();
  const vaultSupplyService = new VaultSupplyService();

  // Process vault supply interest
  console.log("🏦 Processing Vault Supply Interest...\n");
  await vaultSupplyService.processDailySupplySnapshots();

  // Process borrower debt interest
  console.log("\n👥 Processing Borrower Debt Interest...\n");
  await interestService.processDailySnapshot();

  console.log("\n✅ Recalculation complete!\n");
}

async function showNewStats() {
  console.log("=".repeat(70));
  console.log("📊 NEW INTEREST STATS (After Cap Update)");
  console.log("=".repeat(70));

  const stats = await pool.query(`
    SELECT 
      m.name,
      m.apr_cap,
      (m.apr_cap * 100) as apr_cap_percent,
      COUNT(DISTINCT bp.id) as positions,
      COALESCE(SUM(CASE WHEN i.current_rate > m.apr_cap THEN 1 ELSE 0 END), 0) as above_cap,
      COALESCE(SUM(i.interest_above_cap), 0) as total_reimbursable
    FROM markets m
    LEFT JOIN borrower_positions bp ON bp.market_id = m.market_id AND bp.status = 'active'
    LEFT JOIN (
      SELECT DISTINCT ON (position_id) *
      FROM interest_snapshots
      ORDER BY position_id, snapshot_date DESC
    ) i ON i.position_id = bp.id
    GROUP BY m.id, m.name, m.apr_cap
    ORDER BY m.name
  `);

  stats.rows.forEach((stat: any) => {
    console.log(`\n${stat.name}:`);
    console.log(`  New APR Cap: ${stat.apr_cap_percent}%`);
    console.log(`  Active Positions: ${stat.positions}`);
    console.log(`  Positions Above Cap: ${stat.above_cap}`);
    console.log(
      `  Total Reimbursable: ${parseFloat(stat.total_reimbursable).toFixed(6)}`
    );
  });

  console.log("\n" + "=".repeat(70) + "\n");
}

async function main() {
  console.log("\n");
  console.log("╔" + "═".repeat(68) + "╗");
  console.log(
    "║" +
      " ".repeat(15) +
      "🧪 TEST: APR CAP UPDATE SCRIPT" +
      " ".repeat(23) +
      "║"
  );
  console.log("╚" + "═".repeat(68) + "╝");

  try {
    // 1. Show current state
    await showCurrentStats();
    const markets = await showCurrentCaps();

    // 2. Ask which market to update
    const marketIndex = await question(
      "Which market do you want to update? (Enter number): "
    );
    const selectedMarket = markets[parseInt(marketIndex) - 1];

    if (!selectedMarket) {
      console.log("❌ Invalid market selection");
      process.exit(1);
    }

    console.log(`\n✅ Selected: ${selectedMarket.name}`);
    console.log(`   Current Cap: ${selectedMarket.apr_cap_percent}%\n`);

    // 3. Ask for new cap value
    const newCapInput = await question(
      "Enter new APR cap (as percentage, e.g., 15 for 15%): "
    );
    const newCapPercent = parseFloat(newCapInput);

    if (isNaN(newCapPercent) || newCapPercent < 0 || newCapPercent > 100) {
      console.log("❌ Invalid cap value");
      process.exit(1);
    }

    // 4. Confirm
    console.log(`\n⚠️  You are about to:`);
    console.log(
      `   - Change ${selectedMarket.name} cap from ${selectedMarket.apr_cap_percent}% to ${newCapPercent}%`
    );
    console.log(`   - Recalculate all interest for today\n`);

    const confirm = await question("Continue? (yes/no): ");

    if (confirm.toLowerCase() !== "yes") {
      console.log("❌ Cancelled");
      process.exit(0);
    }

    // 5. Update the cap
    await updateMarketCap(selectedMarket.market_id, newCapPercent);

    // 6. Recalculate interest
    await recalculateInterest();

    // 7. Show new stats
    await showNewStats();

    console.log("✅ Test complete! Check the dashboard to see the changes.\n");
  } catch (error: any) {
    console.error("\n❌ Error:", error.message);
    throw error;
  } finally {
    rl.close();
    await pool.end();
  }
}

main();
