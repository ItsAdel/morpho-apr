import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { BorrowerSummary } from "../api/client";

export function BorrowersList() {
  const [borrowers, setBorrowers] = useState<BorrowerSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const limit = 20;

  useEffect(() => {
    loadBorrowers();
  }, [page]);

  const loadBorrowers = async () => {
    try {
      setLoading(true);
      const data = await api.getBorrowersList(limit, page * limit);
      setBorrowers(data.borrowers);
      setTotal(data.total);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load borrowers");
    } finally {
      setLoading(false);
    }
  };

  if (loading && borrowers.length === 0) {
    return (
      <div className="panel">
        <h2 className="panel-header">👥 Real Borrowers</h2>
        <p className="text-gray">Loading borrowers...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="panel">
        <h2 className="panel-header">👥 Real Borrowers</h2>
        <p style={{ color: "#ef4444" }}>{error}</p>
      </div>
    );
  }

  const totalPages = Math.ceil(total / limit);
  const borrowersWithDebt = borrowers.filter(
    (b) => parseFloat(b.total_debt) > 0
  );

  return (
    <div className="panel">
      <div className="panel-header-row">
        <h2 className="panel-header">
          <span>👥</span>
          <span>Real Borrowers</span>
          <span className="badge info">({total} total)</span>
        </h2>
      </div>

      {borrowersWithDebt.length === 0 ? (
        <p className="text-gray">No borrowers with active debt</p>
      ) : (
        <>
          <div style={{ overflowX: "auto", marginBottom: "16px" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Address</th>
                  <th>Positions</th>
                  <th>Total Debt</th>
                  <th>Max Rate</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {borrowersWithDebt.map((borrower, index) => {
                  const debt = parseFloat(borrower.total_debt);
                  const maxRate = parseFloat(borrower.max_rate || "0");
                  const maxCap = parseFloat(borrower.max_cap || "0");
                  const isAboveCap = borrower.has_position_above_cap;

                  return (
                    <tr key={index}>
                      <td>
                        <span
                          style={{
                            fontFamily: "monospace",
                            fontSize: "0.9rem",
                          }}
                        >
                          {borrower.address.slice(0, 6)}...
                          {borrower.address.slice(-4)}
                        </span>
                      </td>
                      <td>{borrower.position_count}</td>
                      <td>
                        <strong>{debt.toFixed(4)}</strong>
                        <span style={{ color: "#6b7280", marginLeft: "4px" }}>
                          ETH/USDC
                        </span>
                      </td>
                      <td>
                        <span style={{ fontWeight: 500 }}>
                          {(maxRate * 100).toFixed(2)}%
                        </span>
                        {maxCap > 0 && (
                          <span
                            style={{
                              color: "#6b7280",
                              fontSize: "0.85rem",
                              marginLeft: "4px",
                            }}
                          >
                            (cap: {(maxCap * 100).toFixed(0)}%)
                          </span>
                        )}
                      </td>
                      <td>
                        {isAboveCap ? (
                          <span className="badge warning">Above Cap</span>
                        ) : (
                          <span className="badge success">Within Cap</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="pagination-btn"
              >
                ← Previous
              </button>
              <span className="pagination-info">
                Page {page + 1} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="pagination-btn"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
