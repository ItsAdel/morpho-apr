import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { PositionAboveCap } from "../api/client";

export function PositionsAboveCap() {
  const [positions, setPositions] = useState<PositionAboveCap[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPositions();
    const interval = setInterval(loadPositions, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadPositions = async () => {
    try {
      const data = await api.getPositionsAboveCap();
      setPositions(data.positions);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load positions");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="panel">
        <h2 className="panel-header">📊 Positions Above Cap</h2>
        <p className="text-gray">Loading positions...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="panel">
        <h2 className="panel-header">📊 Positions Above Cap</h2>
        <p style={{ color: "#ef4444" }}>{error}</p>
      </div>
    );
  }

  if (positions.length === 0) {
    return (
      <div className="panel">
        <h2 className="panel-header">
          <span>📊</span>
          <span>Positions Above Cap</span>
          <span className="badge success">(All Within Cap)</span>
        </h2>
        <p className="text-gray">✅ All positions are below their APR caps</p>
      </div>
    );
  }

  return (
    <div className="panel">
      <h2 className="panel-header">
        <span>📊</span>
        <span>Positions Above Cap</span>
        <span className="badge warning">({positions.length})</span>
      </h2>
      <p className="text-gray" style={{ marginBottom: "16px" }}>
        These positions are paying rates above the configured APR cap and are
        eligible for reimbursement
      </p>
      <div style={{ overflowX: "auto" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Entity</th>
              <th>Market</th>
              <th>Current Debt</th>
              <th>Current Rate</th>
              <th>Cap</th>
              <th>Excess</th>
              <th>Multiplier</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((position, index) => {
              const multiplier = parseFloat(position.rate_multiplier);
              const isHighlyExcess = multiplier > 1.5;

              return (
                <tr key={index}>
                  <td>
                    <div style={{ fontWeight: 500 }}>
                      {position.entity_name}
                    </div>
                    <div
                      style={{
                        fontSize: "0.75rem",
                        color: "#6b7280",
                        fontFamily: "monospace",
                      }}
                    >
                      {position.borrower_address.slice(0, 6)}...
                      {position.borrower_address.slice(-4)}
                    </div>
                  </td>
                  <td>{position.market_name}</td>
                  <td>
                    {parseFloat(position.current_debt).toFixed(4)}{" "}
                    <span style={{ color: "#6b7280" }}>ETH</span>
                  </td>
                  <td>
                    <span style={{ fontWeight: 500 }}>
                      {(parseFloat(position.current_rate) * 100).toFixed(2)}%
                    </span>
                  </td>
                  <td>{(parseFloat(position.apr_cap) * 100).toFixed(2)}%</td>
                  <td>
                    <span style={{ color: "#f59e0b" }}>
                      +{(parseFloat(position.excess_rate) * 100).toFixed(2)}%
                    </span>
                  </td>
                  <td>
                    <span
                      className={`badge ${
                        isHighlyExcess ? "error" : "warning"
                      }`}
                    >
                      {multiplier.toFixed(2)}x
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
