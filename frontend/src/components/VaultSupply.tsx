import type { VaultSupplyStat } from "../api/client";

interface VaultSupplyProps {
  vaultStats: VaultSupplyStat[];
}

export function VaultSupply({ vaultStats }: VaultSupplyProps) {
  if (!vaultStats || vaultStats.length === 0) {
    return (
      <div className="panel">
        <h2 className="panel-header">🏦 Company Vault Supply</h2>
        <p className="text-gray">No vault data available</p>
      </div>
    );
  }

  const totalSupplied = vaultStats.reduce(
    (sum, v) => sum + parseFloat(v.total_supplied || "0"),
    0
  );
  const totalEarned = vaultStats.reduce(
    (sum, v) => sum + parseFloat(v.total_interest_earned || "0"),
    0
  );
  const totalReimbursable = vaultStats.reduce(
    (sum, v) => sum + parseFloat(v.total_reimbursable || "0"),
    0
  );

  return (
    <div className="panel">
      <div className="panel-header-row">
        <h2 className="panel-header">
          <span>🏦</span>
          <span>Company Vault Supply</span>
          <span className="badge info">({vaultStats.length} vaults)</span>
        </h2>
      </div>

      <div className="vault-summary">
        <div className="vault-summary-item">
          <div className="vault-summary-label">Total Supplied</div>
          <div className="vault-summary-value">
            {totalSupplied.toFixed(4)} ETH/USDC
          </div>
        </div>
        <div className="vault-summary-item">
          <div className="vault-summary-label">Today's Earnings</div>
          <div className="vault-summary-value success">
            {totalEarned.toFixed(6)}
          </div>
        </div>
        <div className="vault-summary-item">
          <div className="vault-summary-label">To Reimburse</div>
          <div className="vault-summary-value warning">
            {totalReimbursable.toFixed(6)}
          </div>
        </div>
      </div>

      <div style={{ marginTop: "20px" }}>
        {vaultStats.map((vault, index) => {
          const supplied = parseFloat(vault.total_supplied || "0");
          const earned = parseFloat(vault.total_interest_earned || "0");
          const reimbursable = parseFloat(vault.total_reimbursable || "0");
          const avgApy = parseFloat(vault.avg_supply_apy || "0");

          return (
            <div key={index} className="vault-item">
              <div className="vault-item-header">
                <div>
                  <div className="vault-item-name">{vault.vault_name}</div>
                  <div className="vault-item-address">
                    {vault.vault_address.slice(0, 10)}...
                    {vault.vault_address.slice(-8)}
                  </div>
                </div>
                <div className="vault-item-badge">
                  {vault.markets_count} market
                  {vault.markets_count !== "1" ? "s" : ""}
                </div>
              </div>

              <div className="vault-item-stats">
                <div className="vault-stat">
                  <div className="vault-stat-label">Supplied</div>
                  <div className="vault-stat-value">{supplied.toFixed(4)}</div>
                </div>
                <div className="vault-stat">
                  <div className="vault-stat-label">Interest Earned</div>
                  <div className="vault-stat-value success">
                    {earned.toFixed(6)}
                  </div>
                </div>
                <div className="vault-stat">
                  <div className="vault-stat-label">Above Cap</div>
                  <div className="vault-stat-value warning">
                    {reimbursable.toFixed(6)}
                  </div>
                </div>
                <div className="vault-stat">
                  <div className="vault-stat-label">Avg Supply APY</div>
                  <div className="vault-stat-value">
                    {(avgApy * 100).toFixed(2)}%
                  </div>
                </div>
              </div>

              {reimbursable > 0 && (
                <div className="vault-item-alert">
                  ⚠️ This vault has {reimbursable.toFixed(6)} excess interest
                  that should be reimbursed to borrowers
                </div>
              )}
            </div>
          );
        })}
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
        💡 <strong>Note:</strong> Vaults are Company-owned assets that supply
        liquidity to markets. Interest earned above the APR cap should be
        reimbursed to borrowers via on-chain contract.
      </div>
    </div>
  );
}
