import { useEffect, useState } from "react";
import type { VaultReimbursementPool } from "../api/client";
import { api } from "../api/client";

export function VaultReimbursementPool() {
  const [data, setData] = useState<VaultReimbursementPool | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await api.getVaultReimbursementPool();
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
        <h2 className="panel-header">🏦 Vault Reimbursement Pool</h2>
        <p className="text-gray">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="panel">
        <h2 className="panel-header">🏦 Vault Reimbursement Pool</h2>
        <p style={{ color: "#dc2626" }}>Error: {error}</p>
      </div>
    );
  }

  if (!data || data.vaults.length === 0) {
    return (
      <div className="panel">
        <div className="panel-header-row">
          <h2 className="panel-header">
            <span>🏦</span>
            <span>Vault Reimbursement Pool</span>
            <span className="badge success">(Empty)</span>
          </h2>
        </div>
        <p className="text-gray">
          ✅ No excess interest to reimburse (last 30 days)
        </p>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="panel-header-row">
        <h2 className="panel-header">
          <span>🏦</span>
          <span>Vault Reimbursement Pool</span>
          <span className="badge warning">
            ({data.vaults.length} vault{data.vaults.length !== 1 ? "s" : ""})
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
        <div
          style={{
            fontWeight: 600,
            fontSize: "14px",
            color: "#92400e",
            marginBottom: "8px",
          }}
        >
          Total Pool by Token:
        </div>
        {data.totalsByToken.map((tokenData, idx) => (
          <div
            key={idx}
            style={{ fontSize: "14px", color: "#92400e", marginLeft: "16px" }}
          >
            • {tokenData.total.toFixed(6)} <strong>{tokenData.token}</strong>
          </div>
        ))}
        <div style={{ fontSize: "13px", color: "#92400e", marginTop: "8px" }}>
          Excess interest earned by Company vaults above APR cap (last 30 days)
        </div>
      </div>

      <div className="data-table">
        <table>
          <thead>
            <tr>
              <th>Vault Name</th>
              <th>Address</th>
              <th>Excess Interest by Token</th>
              <th>Markets</th>
            </tr>
          </thead>
          <tbody>
            {data.vaults.map((vault, index) => (
              <tr key={index}>
                <td>
                  <strong>{vault.name}</strong>
                </td>
                <td>
                  <code>
                    {vault.address.slice(0, 10)}...{vault.address.slice(-8)}
                  </code>
                </td>
                <td>
                  {vault.excessByToken.map((tokenData, idx) => (
                    <div key={idx} style={{ marginBottom: "4px" }}>
                      <strong style={{ color: "#f59e0b" }}>
                        {tokenData.amount.toFixed(6)} {tokenData.token}
                      </strong>
                    </div>
                  ))}
                </td>
                <td>
                  <span className="badge info">
                    {vault.markets} market{vault.markets !== 1 ? "s" : ""}
                  </span>
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
        💡 <strong>Reimbursement Pool:</strong> These vaults earned supply
        interest above the APR cap. This excess interest will be reimbursed to
        borrowers via on-chain contract calls.
      </div>
    </div>
  );
}
