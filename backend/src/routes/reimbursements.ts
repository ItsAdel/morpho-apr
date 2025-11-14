import { Router } from "express";
import { reimbursementService } from "../services/reimbursementService";

export const reimbursementsRouter = Router();

// Query reimbursements for any address (vault or borrower)
reimbursementsRouter.get("/address/:address", async (req, res) => {
  try {
    const { address } = req.params;

    const summary = await reimbursementService.getReimbursementsForAddress(
      address
    );

    if (!summary) {
      return res.status(404).json({
        error: "Address not found",
        message: "This address has no positions tracked in the system",
      });
    }

    res.json(summary);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get all borrowers who are owed reimbursements
reimbursementsRouter.get("/pending", async (req, res) => {
  try {
    const data = await reimbursementService.getPendingBorrowerReimbursements();
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get vault reimbursement pool (excess interest to reimburse)
reimbursementsRouter.get("/vault-reimbursement-pool", async (req, res) => {
  try {
    const data = await reimbursementService.getVaultReimbursementPool();
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get reimbursement history for an address
reimbursementsRouter.get("/address/:address/history", async (req, res) => {
  try {
    const { address } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;

    const history = await reimbursementService.getReimbursementHistory(
      address,
      limit
    );

    res.json({ address, history });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
