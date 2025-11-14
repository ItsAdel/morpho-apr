import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { metricsRouter } from "./routes/metrics";
import { reimbursementsRouter } from "./routes/reimbursements";
import { reimbursementProcessingRouter } from "./routes/reimbursementProcessing";
import { pool } from "./config/database";
import { SchedulerService } from "./services/schedulerService";
import { MorphoService } from "./services/morphoService";
import { MORPHO_CONFIG } from "./config/config";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:3000"],
    credentials: true,
  })
);
app.use(express.json());

// Health check
app.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT NOW()");
    res.json({ status: "ok", database: "connected", scheduler: "running" });
  } catch (error) {
    res.status(500).json({ status: "error", database: "disconnected" });
  }
});

// Routes
app.use("/api/metrics", metricsRouter);
app.use("/api/reimbursements", reimbursementsRouter);
app.use("/api/reimbursement-processing", reimbursementProcessingRouter);

// Initialize scheduler
const scheduler = new SchedulerService();

// Manual trigger endpoint (for testing)
app.post("/api/admin/trigger-daily-job", async (req, res) => {
  try {
    console.log("🔧 Manual trigger requested via API");

    // Run in background
    scheduler.runManually().catch((error) => {
      console.error("Error in manual job:", error);
    });

    res.json({
      success: true,
      message: "Daily job triggered. Check server logs for progress.",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Initialize the service on startup
 * - Check if data exists
 * - Seed minimal configuration (markets, vaults) if needed
 * - Sync vault allocations from Morpho API
 * - Start scheduler
 */
async function initializeService() {
  console.log("\n" + "=".repeat(60));
  console.log("🚀 INITIALIZINGW SERVICE");
  console.log("=".repeat(60) + "\n");

  try {
    // Check database connection
    await pool.query("SELECT NOW()");
    console.log("✅ Database connected\n");

    const morphoService = new MorphoService(MORPHO_CONFIG.POLYGON_RPC);

    // Check if we need to seed initial data
    const marketsCount = await pool.query("SELECT COUNT(*) FROM markets");
    const vaultsCount = await pool.query("SELECT COUNT(*) FROM vaults");

    if (
      marketsCount.rows[0].count === "0" ||
      vaultsCount.rows[0].count === "0"
    ) {
      console.log("📋 No data found. Running initial seed...\n");
      await morphoService.seedInitialData(pool);
    } else {
      console.log("✅ Markets and vaults already seeded\n");

      // Still sync vault allocations to get latest data
      console.log("🔄 Syncing latest vault allocations from Morpho...\n");
      await morphoService.syncVaultAllocations(pool);
    }

    // Start scheduler
    console.log("\n" + "=".repeat(60));
    scheduler.start();
    console.log("=".repeat(60) + "\n");

    console.log("✨ Service initialization complete!\n");
  } catch (error: any) {
    console.error("❌ Initialization failed:", error.message);
    throw error;
  }
}

// Start server and initialize
const server = app.listen(PORT, async () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 Metrics API: http://localhost:${PORT}/api/metrics/dashboard`);
  console.log(
    `💰 Pending Reimbursements: http://localhost:${PORT}/api/reimbursements/pending`
  );
  console.log(
    `🏦 Vault Reimbursement Pool: http://localhost:${PORT}/api/reimbursements/vault-reimbursement-pool`
  );
  console.log(
    `🔧 Manual trigger: POST http://localhost:${PORT}/api/admin/trigger-daily-job\n`
  );

  // Initialize service after server starts
  await initializeService();
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("\n👋 SIGTERM received, closing server...");
  scheduler.stop();
  server.close(() => {
    console.log("✅ Server closed");
    pool.end();
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("\n👋 SIGINT received, closing server...");
  scheduler.stop();
  server.close(() => {
    console.log("✅ Server closed");
    pool.end();
    process.exit(0);
  });
});
