import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Alert } from "../api/client";

export function AlertsPanel() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAlerts();
    const interval = setInterval(loadAlerts, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadAlerts = async () => {
    try {
      const data = await api.getAlerts();
      setAlerts(data.alerts);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load alerts");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="panel">
        <h2 className="panel-header">⚠️ Alerts</h2>
        <p className="text-gray">Loading alerts...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="panel">
        <h2 className="panel-header">⚠️ Alerts</h2>
        <p style={{ color: "#ef4444" }}>{error}</p>
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <div className="panel">
        <h2 className="panel-header">
          <span>⚠️</span>
          <span>Alerts</span>
          <span className="badge success">(All Clear)</span>
        </h2>
        <p className="text-gray">✅ No markets exceeding 2x APR cap</p>
      </div>
    );
  }

  // Calculate severity levels
  const criticalAlerts = alerts.filter(
    (a) => parseFloat(a.rate_multiplier) >= 3
  );
  const highAlerts = alerts.filter(
    (a) =>
      parseFloat(a.rate_multiplier) >= 2 && parseFloat(a.rate_multiplier) < 3
  );

  return (
    <div className="panel">
      <h2 className="panel-header">
        <span>🚨</span>
        <span>Critical Rate Alerts</span>
        <span className="badge error">({alerts.length})</span>
      </h2>

      {criticalAlerts.length > 0 && (
        <div style={{ marginBottom: "16px" }}>
          <div
            style={{
              fontWeight: 600,
              color: "#dc2626",
              marginBottom: "8px",
              fontSize: "14px",
            }}
          >
            🔴 CRITICAL: Rates ≥3x Cap ({criticalAlerts.length})
          </div>
          {criticalAlerts.map((alert, index) => (
            <div
              key={index}
              className="alert-item"
              style={{ borderLeft: "4px solid #dc2626" }}
            >
              <div className="alert-item-title">{alert.market_name}</div>
              <div className="alert-item-details">
                Current Rate:{" "}
                <strong>
                  {(parseFloat(alert.current_rate) * 100).toFixed(2)}%
                </strong>{" "}
                | Cap: {(parseFloat(alert.apr_cap) * 100).toFixed(2)}% |{" "}
                <strong style={{ color: "#dc2626" }}>
                  {parseFloat(alert.rate_multiplier).toFixed(2)}x over cap
                </strong>
              </div>
            </div>
          ))}
        </div>
      )}

      {highAlerts.length > 0 && (
        <div>
          <div
            style={{
              fontWeight: 600,
              color: "#f59e0b",
              marginBottom: "8px",
              fontSize: "14px",
            }}
          >
            🟠 HIGH: Rates 2-3x Cap ({highAlerts.length})
          </div>
          {highAlerts.map((alert, index) => (
            <div
              key={index}
              className="alert-item"
              style={{ borderLeft: "4px solid #f59e0b", background: "#fef3c7" }}
            >
              <div className="alert-item-title">{alert.market_name}</div>
              <div className="alert-item-details">
                Current Rate:{" "}
                <strong>
                  {(parseFloat(alert.current_rate) * 100).toFixed(2)}%
                </strong>{" "}
                | Cap: {(parseFloat(alert.apr_cap) * 100).toFixed(2)}% |{" "}
                <strong style={{ color: "#f59e0b" }}>
                  {parseFloat(alert.rate_multiplier).toFixed(2)}x over cap
                </strong>
              </div>
            </div>
          ))}
        </div>
      )}

      <div
        style={{
          marginTop: "16px",
          padding: "12px",
          background: "#f9fafb",
          borderRadius: "6px",
          fontSize: "13px",
          color: "#6b7280",
        }}
      >
        💡 <strong>Alert Thresholds:</strong> Critical (≥3x cap), High (2-3x
        cap), Above Cap (shown in table above)
      </div>
    </div>
  );
}
