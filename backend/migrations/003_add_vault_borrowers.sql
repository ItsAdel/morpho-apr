-- Add vault_id column to borrower_positions to support vaults as entities
ALTER TABLE borrower_positions 
ADD COLUMN vault_id INTEGER REFERENCES vaults(id);

-- Drop old unique constraint
ALTER TABLE borrower_positions 
DROP CONSTRAINT IF EXISTS borrower_positions_borrower_id_market_id_key;

-- Add check constraint: either borrower_id OR vault_id must be set (not both, not neither)
ALTER TABLE borrower_positions
ADD CONSTRAINT check_borrower_or_vault 
CHECK (
  (borrower_id IS NOT NULL AND vault_id IS NULL) OR 
  (borrower_id IS NULL AND vault_id IS NOT NULL)
);

-- Create unique constraint that works for both borrowers and vaults
CREATE UNIQUE INDEX idx_borrower_positions_unique 
ON borrower_positions (
  COALESCE(borrower_id, -1), 
  COALESCE(vault_id, -1), 
  market_id
);

-- Add index for vault_id lookups
CREATE INDEX idx_borrower_positions_vault ON borrower_positions(vault_id);

-- Add index for market_id lookups
CREATE INDEX idx_borrower_positions_market ON borrower_positions(market_id);

