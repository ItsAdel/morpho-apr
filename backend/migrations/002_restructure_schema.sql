-- Drop old tables
DROP TABLE IF EXISTS reimbursements CASCADE;
DROP TABLE IF EXISTS interest_snapshots CASCADE;
DROP TABLE IF EXISTS positions CASCADE;
DROP TABLE IF EXISTS market_configs CASCADE;
DROP TABLE IF EXISTS borrowers CASCADE;

-- Markets are the core lending/borrowing pairs
CREATE TABLE markets (
  id SERIAL PRIMARY KEY,
  market_id VARCHAR(66) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  collateral_asset VARCHAR(50),
  loan_asset VARCHAR(50),
  lltv DECIMAL(24, 18),
  apr_cap DECIMAL(10, 6) NOT NULL,
  alert_threshold DECIMAL(10, 6),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Vaults are liquidity providers (like users, but they lend)
CREATE TABLE vaults (
  id SERIAL PRIMARY KEY,
  address VARCHAR(42) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  symbol VARCHAR(20),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Vault allocations: which markets each vault supplies liquidity to
CREATE TABLE vault_allocations (
  id SERIAL PRIMARY KEY,
  vault_id INTEGER REFERENCES vaults(id),
  market_id VARCHAR(66) REFERENCES markets(market_id),
  supply_assets DECIMAL(36, 18),
  supply_assets_usd DECIMAL(24, 2),
  last_updated TIMESTAMP DEFAULT NOW(),
  UNIQUE(vault_id, market_id)
);

-- Borrowers are users who borrow from markets
CREATE TABLE borrowers (
  id SERIAL PRIMARY KEY,
  address VARCHAR(42) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Borrower positions in specific markets
CREATE TABLE borrower_positions (
  id SERIAL PRIMARY KEY,
  borrower_id INTEGER REFERENCES borrowers(id),
  market_id VARCHAR(66) REFERENCES markets(market_id),
  principal_borrowed DECIMAL(36, 18) NOT NULL,
  current_debt DECIMAL(36, 18) NOT NULL,
  opened_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW(),
  status VARCHAR(20) DEFAULT 'active',
  UNIQUE(borrower_id, market_id)
);

-- Daily interest snapshots for each borrower position
CREATE TABLE interest_snapshots (
  id SERIAL PRIMARY KEY,
  position_id INTEGER REFERENCES borrower_positions(id),
  snapshot_date DATE NOT NULL,
  current_rate DECIMAL(10, 6) NOT NULL,
  capped_rate DECIMAL(10, 6) NOT NULL,
  interest_accrued DECIMAL(36, 18) NOT NULL,
  interest_above_cap DECIMAL(36, 18) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Reimbursements for interest above cap
CREATE TABLE reimbursements (
  id SERIAL PRIMARY KEY,
  position_id INTEGER REFERENCES borrower_positions(id),
  amount DECIMAL(36, 18) NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  tx_hash VARCHAR(66),
  created_at TIMESTAMP DEFAULT NOW(),
  processed_at TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_vault_allocations_vault ON vault_allocations(vault_id);
CREATE INDEX idx_vault_allocations_market ON vault_allocations(market_id);
CREATE INDEX idx_borrower_positions_borrower ON borrower_positions(borrower_id);
CREATE INDEX idx_borrower_positions_market ON borrower_positions(market_id);
CREATE INDEX idx_interest_snapshots_position ON interest_snapshots(position_id);
CREATE INDEX idx_interest_snapshots_date ON interest_snapshots(snapshot_date);