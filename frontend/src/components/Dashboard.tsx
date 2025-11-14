import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { DashboardMetrics } from "../api/client";
import { MetricsCard } from "./MetricsCard";
import { AlertsPanel } from "./AlertsPanel";
import { PositionsAboveCap } from "./PositionsAboveCap";
import { MarketBreakdown } from "./MarketBreakdown";
import { VaultSupply } from "./VaultSupply";
import { BorrowersList } from "./BorrowersList";
import { PendingReimbursements } from "./PendingReimbursements";
import { VaultReimbursementPool } from "./VaultReimbursementPool";

export function Dashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  useEffect(() => {
    loadMetrics();
    const interval = setInterval(() => {
      loadMetrics();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const loadMetrics = async () => {
    try {
      const data = await api.getDashboardMetrics();
      setMetrics(data);
      setLastUpdate(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load metrics");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-content">
          <div className="loading-icon">⏳</div>
          <p>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-screen">
        <div className="error-content">
          <div className="error-icon">❌</div>
          <h2 className="error-title">Connection Error</h2>
          <p className="error-message">{error}</p>
          <p className="error-help">
            Make sure the backend server is running on http://localhost:3000
          </p>
          <button onClick={loadMetrics} className="btn">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!metrics) return null;

  return (
    <div style={{ minHeight: "100vh", background: "#f5f5f5" }}>
      {/* Header */}
      <header className="header">
        <div className="container">
          <div className="header-content">
            <div>
              <h1>Company APR Management Dashboard</h1>
              <p className="header-subtitle">
                Monitoring {metrics.realBorrowers} real borrowers across Morpho
                markets on Polygon
              </p>
            </div>
            <div className="last-update">
              <div>Last updated</div>
              <div>{lastUpdate.toLocaleTimeString()}</div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container">
        {/* Key Metrics Grid */}
        <div className="grid grid-4">
          <MetricsCard
            title="Real Borrowers"
            value={metrics.realBorrowers}
            subtitle={`${metrics.activeVaults} Company vaults`}
            icon="👤"
            status="info"
          />
          <MetricsCard
            title="Borrowers Above Cap"
            value={metrics.realBorrowersAboveCap}
            subtitle="Eligible for reimbursement"
            icon="⚠️"
            status={metrics.realBorrowersAboveCap > 0 ? "warning" : "success"}
          />
          <MetricsCard
            title="Vault Supply Interest"
            value={metrics.vaultSupplyInterest.toFixed(6)}
            subtitle="Company's daily earnings"
            icon="🏦"
            status="info"
          />
          <MetricsCard
            title="To Reimburse (Vault)"
            value={metrics.vaultSupplyAboveCap.toFixed(6)}
            subtitle="Excess vault interest"
            icon="💸"
            status={metrics.vaultSupplyAboveCap > 0 ? "warning" : "success"}
          />
        </div>

        {/* Positions Above Cap Details */}
        <PositionsAboveCap />

        {/* Alerts Panel */}
        <AlertsPanel />

        {/* Company Vault Supply */}
        <VaultSupply vaultStats={metrics.vaultStats} />

        {/* Reimbursement Tracking */}
        <div className="grid grid-2">
          <PendingReimbursements />
          <VaultReimbursementPool />
        </div>

        {/* Borrowers List */}
        <BorrowersList />

        {/* Market Breakdown */}
        <MarketBreakdown markets={metrics.marketBreakdown} />

        {/* Footer Info */}
        <div className="footer">
          <p>
            Tracking {metrics.realBorrowers} real borrowers across{" "}
            {metrics.marketBreakdown.length} markets on Morpho (Polygon) |
            Auto-refreshes every 30 seconds
          </p>
        </div>
      </main>
    </div>
  );
}
