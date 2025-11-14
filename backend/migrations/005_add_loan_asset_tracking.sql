-- Migration to add loan asset tracking for token-aware reimbursements
-- This ensures we know which token (WETH, USDC, etc.) to reimburse

-- Add loan_asset to vault_allocations
ALTER TABLE vault_allocations 
ADD COLUMN IF NOT EXISTS loan_asset VARCHAR(20);

-- Add loan_asset to vault_supply_snapshots
ALTER TABLE vault_supply_snapshots 
ADD COLUMN IF NOT EXISTS loan_asset VARCHAR(20);

-- Add loan_asset to interest_snapshots (for borrower positions)
ALTER TABLE interest_snapshots
ADD COLUMN IF NOT EXISTS loan_asset VARCHAR(20);

-- Add loan_asset to reimbursements
ALTER TABLE reimbursements
ADD COLUMN IF NOT EXISTS loan_asset VARCHAR(20);

-- Update existing records with loan_asset from markets table
UPDATE vault_allocations va
SET loan_asset = m.loan_asset
FROM markets m
WHERE va.market_id = m.market_id
AND va.loan_asset IS NULL;

UPDATE vault_supply_snapshots vss
SET loan_asset = m.loan_asset
FROM markets m
WHERE vss.market_id = m.market_id
AND vss.loan_asset IS NULL;

UPDATE interest_snapshots isn
SET loan_asset = m.loan_asset
FROM borrower_positions bp
JOIN markets m ON m.market_id = bp.market_id
WHERE isn.position_id = bp.id
AND isn.loan_asset IS NULL;

UPDATE reimbursements r
SET loan_asset = m.loan_asset
FROM borrower_positions bp
JOIN markets m ON m.market_id = bp.market_id
WHERE r.position_id = bp.id
AND r.loan_asset IS NULL;

-- Add comments
COMMENT ON COLUMN vault_allocations.loan_asset IS 'The token supplied/lent (WETH, USDC, etc.)';
COMMENT ON COLUMN vault_supply_snapshots.loan_asset IS 'The token that interest is earned in';
COMMENT ON COLUMN interest_snapshots.loan_asset IS 'The token that interest is accrued in';
COMMENT ON COLUMN reimbursements.loan_asset IS 'The token that reimbursement is paid in';

