import * as dotenv from "dotenv";
import { pool } from "../config/database";
import { MorphoService } from "../services/morphoService";
import { MORPHO_CONFIG } from "../config/config";

dotenv.config();

async function main() {
  const morphoService = new MorphoService(MORPHO_CONFIG.POLYGON_RPC);

  try {
    await morphoService.syncBorrowers(pool);
  } catch (error: any) {
    console.error("\n❌ Fatal error:", error.message);
    console.error(error);
  } finally {
    await pool.end();
    console.log("👋 Disconnected from database");
  }
}

main();
