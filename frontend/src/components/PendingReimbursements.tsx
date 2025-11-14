import { useEffect, useState } from "react";
import type { PendingReimbursements } from "../api/client";
import { api } from "../api/client";

export function PendingReimbursements() {
  const [data, setData] = useState<PendingReimbursements | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await api.getPendingReimbursements();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  if (loading && !data) {
    return (
      <div className="panel">
        <h2 className="panel-header">💰 Pending Reimbursements</h2>
        <p className="text-gray">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="panel">
        <h2 className="panel-header">💰 Pending Reimbursements</h2>
        <p style={{ color: "#dc2626" }}>Error: {error}</p>
      </div>
    );
  }

  if (!data || data.borrowers.length === 0) {
    return (
      <div className="panel">
        <div className="panel-header-row">
          <h2 className="panel-header">
            <span>💰</span>
            <span>Pending Reimbursements</span>
            <span className="badge success">(All Paid)</span>
          </h2>
        </div>
        <p className="text-gray">✅ No pending reimbursements</p>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="panel-header-row">
        <h2 className="panel-header">
          <span>💰</span>
          <span>Pending Reimbursements</span>
          <span className="badge warning">
            ({data.borrowers.length} borrower
            {data.borrowers.length !== 1 ? "s" : ""})
          </span>
        </h2>
      </div>

      <div
        style={{
          marginBottom: "20px",
          padding: "16px",
          background: "#fef3c7",
          borderRadius: "8px",
          borderLeft: "4px solid #f59e0b",
        }}
      >
        <div style={{ fontWeight: 600, fontSize: "14px", color: "#92400e" }}>
          Total Pending: {data.totalOwedAcrossAllBorrowers.toFixed(6)} tokens
        </div>
        <div style={{ fontSize: "13px", color: "#92400e", marginTop: "4px" }}>
          These borrowers paid interest above cap and are owed reimbursements
        </div>
      </div>

      <div className="data-table">
        <table>
          <thead>
            <tr>
              <th>Borrower Address</th>
              <th>Amount Owed</th>
              <th>Pending Count</th>
              <th>Markets</th>
            </tr>
          </thead>
          <tbody>
            {data.borrowers.map((borrower, index) => (
              <tr key={index}>
                <td>
                  <code>
                    {borrower.address.slice(0, 10)}...
                    {borrower.address.slice(-8)}
                  </code>
                </td>
                <td>
                  <strong style={{ color: "#f59e0b" }}>
                    {borrower.totalOwed.toFixed(6)}
                  </strong>
                </td>
                <td>
                  <span className="badge info">{borrower.pendingCount}</span>
                </td>
                <td>
                  <div style={{ fontSize: "12px", color: "#6b7280" }}>
                    {borrower.markets.join(", ")}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div
        style={{
          marginTop: "16px",
          padding: "12px",
          background: "#f0f9ff",
          borderRadius: "6px",
          fontSize: "13px",
          color: "#0369a1",
        }}
      >
        💡 <strong>Note:</strong> Reimbursements will be processed via smart
        contract calls to transfer funds from company vaults to borrowers.
      </div>
    </div>
  );
}
