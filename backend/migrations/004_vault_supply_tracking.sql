-- Migration to add vault supply interest tracking
-- Vaults are suppliers - they earn interest on supplied capital

-- Create vault_supply_snapshots table to track daily supply interest
CREATE TABLE IF NOT EXISTS vault_supply_snapshots (
  id SERIAL PRIMARY KEY,
  vault_id INTEGER REFERENCES vaults(id),
  market_id VARCHAR(66) REFERENCES markets(market_id),
  snapshot_date DATE NOT NULL,
  supply_amount DECIMAL(36, 18) NOT NULL,      -- Amount supplied to market
  supply_apy DECIMAL(10, 6) NOT NULL,          -- Current supply APY
  capped_apy DECIMAL(10, 6) NOT NULL,          -- APR cap for this market
  interest_earned DECIMAL(36, 18) NOT NULL,    -- Daily interest earned
  interest_above_cap DECIMAL(36, 18) NOT NULL, -- Interest earned above cap (to be reimbursed)
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(vault_id, market_id, snapshot_date)
);

-- Index for performance
CREATE INDEX idx_vault_supply_snapshots_vault ON vault_supply_snapshots(vault_id);
CREATE INDEX idx_vault_supply_snapshots_market ON vault_supply_snapshots(market_id);
CREATE INDEX idx_vault_supply_snapshots_date ON vault_supply_snapshots(snapshot_date);

-- Comments for clarity
COMMENT ON TABLE vault_supply_snapshots IS 'Daily snapshots of interest earned by our vaults on their supplied capital';
COMMENT ON COLUMN vault_supply_snapshots.interest_above_cap IS 'Excess interest earned above cap - to be reimbursed to borrowers';

