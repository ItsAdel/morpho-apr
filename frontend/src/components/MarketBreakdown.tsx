import type { MarketBreakdown as MarketData } from "../api/client";

interface MarketBreakdownProps {
  markets: MarketData[];
}

export function MarketBreakdown({ markets }: MarketBreakdownProps) {
  if (markets.length === 0) {
    return (
      <div className="panel">
        <h2 className="panel-header">📊 Market Breakdown</h2>
        <p className="text-gray">No market data available</p>
      </div>
    );
  }

  return (
    <div className="panel">
      <h2 className="panel-header">📊 Market Breakdown</h2>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Market</th>
              <th>Active Positions</th>
              <th>Total Reimbursed (30d)</th>
            </tr>
          </thead>
          <tbody>
            {markets.map((market) => (
              <tr key={market.market_id}>
                <td>
                  <div className="table-cell-main">{market.name}</div>
                  <div className="table-cell-sub">
                    {market.market_id.substring(0, 10)}...
                  </div>
                </td>
                <td>{market.active_positions}</td>
                <td>
                  <span className="table-value-success">
                    ${parseFloat(market.total_reimbursed).toFixed(2)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
