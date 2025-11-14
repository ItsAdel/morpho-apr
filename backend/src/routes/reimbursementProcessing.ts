import { Router } from "express";
import { reimbursementService } from "../services/reimbursementService";

export const reimbursementProcessingRouter = Router();

/**
 * Process pending reimbursements (simulate payments)
 * POST /api/reimbursement-processing/process?limit=10
 */
reimbursementProcessingRouter.post("/process", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;

    const result = await reimbursementService.processPendingReimbursements(
      limit
    );

    res.json({
      success: true,
      processed: result.processed,
      failed: result.failed,
      totalAmount: result.totalAmount,
      message: `Successfully processed ${result.processed} reimbursements`,
    });
  } catch (error: any) {
    console.error("Error processing reimbursements:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Get reimbursement statistics
 * GET /api/reimbursement-processing/stats
 */
reimbursementProcessingRouter.get("/stats", async (req, res) => {
  try {
    const stats = await reimbursementService.getStats();

    res.json({
      success: true,
      stats,
    });
  } catch (error: any) {
    console.error("Error fetching reimbursement stats:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Retry failed reimbursements
 * POST /api/reimbursement-processing/retry?limit=5
 */
reimbursementProcessingRouter.post("/retry", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 5;

    const retryCount = await reimbursementService.retryFailedReimbursements(
      limit
    );

    res.json({
      success: true,
      retriedCount: retryCount,
      message: `Reset ${retryCount} failed reimbursements to pending`,
    });
  } catch (error: any) {
    console.error("Error retrying failed reimbursements:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Create reimbursement entries from today's interest snapshots
 * POST /api/reimbursement-processing/create-entries
 */
reimbursementProcessingRouter.post("/create-entries", async (req, res) => {
  try {
    const date = req.body.date ? new Date(req.body.date) : new Date();

    const createdCount = await reimbursementService.createReimbursementEntries(
      date
    );

    res.json({
      success: true,
      createdCount,
      message: `Created ${createdCount} reimbursement entries`,
    });
  } catch (error: any) {
    console.error("Error creating reimbursement entries:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});
