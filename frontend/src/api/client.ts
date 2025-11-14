const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

// Dashboard metrics interface
export interface DashboardMetrics {
  totalActiveBorrowers: number;
  realBorrowers: number;
  activeVaults: number;
  borrowersAboveCap: number;
  borrowersBelowCap: number;
  realBorrowersAboveCap: number;
  realBorrowersBelowCap: number;
  vaultsAboveCap: number;
  vaultsBelowCap: number;
  dailyReimbursedUSD: string;
  vaultSupplyInterest: number;
  vaultSupplyAboveCap: number;
  vaultStats: VaultSupplyStat[];
  marketBreakdown: MarketBreakdown[];
}

export interface VaultSupplyStat {
  vault_name: string;
  vault_address: string;
  markets_count: string;
  total_supplied: string;
  total_interest_earned: string;
  total_reimbursable: string;
  avg_supply_apy: string;
}

export interface MarketBreakdown {
  name: string;
  market_id: string;
  active_positions: string;
  total_reimbursed: string;
}

export interface Alert {
  market_name: string;
  current_rate: string;
  apr_cap: string;
  rate_multiplier: string;
}

export interface PositionAboveCap {
  market_name: string;
  borrower_address: string;
  entity_name: string;
  current_debt: string;
  current_rate: string;
  apr_cap: string;
  rate_multiplier: string;
  excess_rate: string;
  snapshot_date: string;
}

// Pending reimbursements (borrowers owed money)
export interface BorrowerReimbursement {
  address: string;
  totalOwed: number;
  pendingCount: number;
  markets: string[];
}

export interface PendingReimbursements {
  borrowers: BorrowerReimbursement[];
  totalOwedAcrossAllBorrowers: number;
}

// Vault reimbursement pool (excess interest to reimburse)
export interface VaultReimbursement {
  name: string;
  address: string;
  excessByToken: Array<{ token: string; amount: number }>;
  markets: number;
}

export interface VaultReimbursementPool {
  vaults: VaultReimbursement[];
  totalsByToken: Array<{ token: string; total: number }>;
}

export interface BorrowerSummary {
  address: string;
  position_count: string;
  total_debt: string;
  max_rate: string;
  max_cap: string;
  has_position_above_cap: boolean;
}

export interface BorrowersListResponse {
  borrowers: BorrowerSummary[];
  total: number;
  limit: number;
  offset: number;
}

export const api = {
  async getDashboardMetrics(): Promise<DashboardMetrics> {
    const response = await fetch(`${API_BASE_URL}/api/metrics/dashboard`);
    if (!response.ok) throw new Error("Failed to fetch dashboard metrics");
    return response.json();
  },

  async getAlerts(): Promise<{ alerts: Alert[] }> {
    const response = await fetch(`${API_BASE_URL}/api/metrics/alerts`);
    if (!response.ok) throw new Error("Failed to fetch alerts");
    return response.json();
  },

  async getPositionsAboveCap(): Promise<{ positions: PositionAboveCap[] }> {
    const response = await fetch(`${API_BASE_URL}/api/metrics/above-cap`);
    if (!response.ok) throw new Error("Failed to fetch positions above cap");
    return response.json();
  },

  async getPendingReimbursements(): Promise<PendingReimbursements> {
    const response = await fetch(`${API_BASE_URL}/api/reimbursements/pending`);
    if (!response.ok) throw new Error("Failed to fetch pending reimbursements");
    return response.json();
  },

  async getVaultReimbursementPool(): Promise<VaultReimbursementPool> {
    const response = await fetch(
      `${API_BASE_URL}/api/reimbursements/vault-reimbursement-pool`
    );
    if (!response.ok)
      throw new Error("Failed to fetch vault reimbursement pool");
    return response.json();
  },

  async getAddressReimbursements(address: string) {
    const response = await fetch(
      `${API_BASE_URL}/api/reimbursements/address/${address}`
    );
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error("Address not found in system");
      }
      throw new Error("Failed to fetch address reimbursements");
    }
    return response.json();
  },

  async getBorrowersList(
    limit: number = 50,
    offset: number = 0
  ): Promise<BorrowersListResponse> {
    const response = await fetch(
      `${API_BASE_URL}/api/metrics/borrowers?limit=${limit}&offset=${offset}`
    );
    if (!response.ok) throw new Error("Failed to fetch borrowers list");
    return response.json();
  },
};
