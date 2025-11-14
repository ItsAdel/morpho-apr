import * as dotenv from "dotenv";
import { MorphoService } from "../services/morphoService";
import { MORPHO_CONFIG } from "../config/config";

dotenv.config();

async function testMorphoConnection() {
  console.log("🧪 Testing Morpho API Connection...\n");

  const morphoService = new MorphoService(process.env.POLYGON_RPC_URL!);

  // Test each market
  const markets = [
    { id: MORPHO_CONFIG.MARKETS.WSTETH_WETH, name: "wstETH/WETH" },
    { id: MORPHO_CONFIG.MARKETS.WBTC_USDC, name: "WBTC/USDC" },
    { id: MORPHO_CONFIG.MARKETS.WPOL_USDC, name: "WPOL/USDC" },
  ];

  for (const market of markets) {
    console.log(`\n📊 Testing Market: ${market.name}`);
    console.log(`Market ID: ${market.id}`);

    try {
      const marketData = await morphoService.getBorrowerPositions(market.id);

      console.log(`✅ Successfully fetched data`);

      if (marketData && marketData.length > 0 && marketData[0].state) {
        const state = marketData[0].state;
        console.log(`\n   Market State:`);
        console.log(`   - Borrow APY: ${state.borrowApy || "N/A"}`);
        console.log(`   - Supply APY: ${state.supplyApy || "N/A"}`);
        console.log(`   - Borrow Assets: ${state.borrowAssets || "N/A"}`);
        console.log(`   - Supply Assets: ${state.supplyAssets || "N/A"}`);
      }
    } catch (error: any) {
      console.error(`❌ Error fetching market data:`, error.message);
    }
  }

  console.log("\n\n🎯 Testing Vault Contract Call...");

  try {
    const vaultData = await morphoService.getMarketData(
      MORPHO_CONFIG.VAULTS.COMPOUND_WETH,
      MORPHO_CONFIG.MARKETS.WSTETH_WETH
    );

    console.log("✅ Vault data retrieved:");
    console.log(`   Total Assets: ${vaultData.totalAssets}`);
    console.log(`   Total Supply: ${vaultData.totalSupply}`);
  } catch (error) {
    console.error("❌ Error calling vault contract:", error);
  }

  console.log("\n✨ Test complete!\n");
}

testMorphoConnection().catch(console.error);
