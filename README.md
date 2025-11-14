# Company APR Service

An interest rate monitoring and reimbursement service for Morpho protocol markets. This service tracks borrower positions across Morpho markets, calculates interest above configurable APR caps, and manages reimbursements to borrowers.

Company operates vaults that supply liquidity to Morpho markets. When borrowers pay interest rates above a defined cap, Company reimburses them for the excess amount. This service:

1. **Monitors** borrower positions across 3 Morpho markets (Polygon)
2. **Tracks** interest accrued by vaults (Company's earnings) and borrowers (their debt)
3. **Calculates** interest amounts above APR caps
4. **Manages** reimbursement pool and pending reimbursements
5. **Provides** a dashboard for monitoring and alerting

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        MORPHO PROTOCOL                       │
│  (On-chain markets, vault contracts, borrower positions)    │
└────────────────────┬────────────────────────────────────────┘
                     │ GraphQL API + RPC
                     ↓
┌─────────────────────────────────────────────────────────────┐
│                       BACKEND SERVICE                        │
│  • Node.js/TypeScript/Express                               │
│  • PostgreSQL database                                       │
│  • Daily scheduler (node-cron)                               │
│  • REST APIs for metrics & reimbursements                    │
└────────────────────┬────────────────────────────────────────┘
                     │ REST API
                     ↓
┌─────────────────────────────────────────────────────────────┐
│                       FRONTEND DASHBOARD                     │
│  • React + Vite                                              │
│  • Real-time metrics display                                 │
│  • Borrower tracking & alerts                                │
└─────────────────────────────────────────────────────────────┘
```

## Tracked Assets

### Markets (3 Morpho V1 Markets on Polygon)

- **wstETH/WETH** (91.5% LLTV) - APR cap: 12%
- **WBTC/USDC** (86% LLTV) - APR cap: 10%
- **WPOL/USDC** (77% LLTV) - APR cap: 15%

### Vaults (Company-owned suppliers)

- **Compound WETH** - Supplies WETH to wstETH/WETH market
- **Compound USDT** - Supplies USDC to WBTC/USDC market
- **Steakhouse High Yield USDC** - Supplies USDC to WPOL/USDC market

## Backend Service

### Technology Stack

- **Node.js 20.10+** with TypeScript
- **Express** for REST APIs
- **PostgreSQL** for data persistence
- **ethers.js** for Ethereum interactions
- **node-cron** for scheduled jobs

### Key Components

#### 1. Services (`backend/src/services/`)

**`morphoService.ts`**

- Interfaces with Morpho GraphQL API and contracts
- Fetches market data (rates, total supply/borrow)
- Syncs borrower positions and vault allocations
- Seeds initial configuration (markets + vaults)

**`interestService.ts`**

- Processes daily borrower debt interest
- Calculates interest above APR caps
- Creates reimbursement records for borrowers
- Updates position debt balances

**`vaultSupplyService.ts`**

- Processes daily vault supply interest (Company's earnings)
- Tracks interest earned above caps
- Provides token-specific summaries (WETH, USDC)

**`reimbursementService.ts`**

- Queries reimbursement data by address
- Tracks pending borrower reimbursements
- Calculates vault reimbursement pool
- Processes reimbursement payments (stub for on-chain execution)

**`schedulerService.ts`**

- Runs daily at midnight UTC
- Orchestrates vault supply and borrower interest processing
- Provides manual trigger capability

#### 2. API Routes (`backend/src/routes/`)

**Metrics API** (`/api/metrics`)

- `GET /dashboard` - Overview metrics (borrowers, vaults, rates)
- `GET /borrowers` - Paginated list of borrowers
- `GET /above-cap` - Positions exceeding APR caps
- `GET /alerts` - Rate alerts (critical/high thresholds)

**Reimbursements API** (`/api/reimbursements`)

- `GET /pending` - Borrowers owed reimbursements
- `GET /vault-reimbursement-pool` - Vault excess interest by token
- `GET /address/:address` - Reimbursement summary for any address
- `GET /address/:address/history` - Historical reimbursements

**Processing API** (`/api/reimbursement-processing`)

- `POST /process-pending` - Trigger reimbursement processing (simulated)
- `GET /summary` - Processing statistics

**Admin API**

- `POST /api/admin/trigger-daily-job` - Manually trigger daily interest job

#### 3. Database Schema (`backend/migrations/`)

**Core Tables:**

- `markets` - Tracked Morpho markets with APR caps
- `vaults` - Company-owned vault contracts
- `vault_allocations` - Vault supply positions per market
- `borrowers` - Individual borrower addresses
- `borrower_positions` - Active borrowing positions
- `interest_snapshots` - Daily interest calculations
- `reimbursements` - Reimbursement records with status
- `vault_supply_snapshots` - Daily vault earnings tracking

### Daily Processing Flow

```
1. Service Startup
   ↓
2. Check DB for markets/vaults
   ↓
3. Seed if needed (minimal: markets + vaults only)
   ↓
4. Sync vault allocations from Morpho API
   ↓
5. Start scheduler (midnight UTC)
   ↓
6. Daily Job Triggers:
   ├─ Fetch current market rates from Morpho
   ├─ Process vault supply interest
   │  ├─ Calculate interest earned
   │  └─ Track excess above cap
   ├─ Process borrower debt interest
   │  ├─ Calculate interest accrued
   │  ├─ Determine excess above cap
   │  └─ Create reimbursement records
   └─ Update all positions
```

### Setup & Run

```bash
# 1. Install dependencies
cd backend
npm install

# 2. Setup PostgreSQL
createdb company

# 3. Run migrations
npm run migrate:fresh
npm run migrate:vaults
npm run migrate:vault-supply
npm run migrate:loan-assets

# 4. Configure environment
# Create backend/.env with:
# DATABASE_URL=postgresql://localhost/company
# POLYGON_RPC=<your-polygon-rpc-url>

# 5. Start server (auto-initializes on first run)
npm run dev

# Server runs on http://localhost:3000
# Scheduler starts automatically
# Syncs vault allocations from Morpho API on startup
```

### Manual Scripts

```bash
# Test Morpho API connection
npm run test:morpho

# Manually seed markets/vaults
npm run seed:morpho

# Sync borrowers from Morpho
npm run sync:borrowers

# Run daily interest calculation
npm run daily:interest

# Process pending reimbursements
npm run process:reimbursements

# Test APR cap update
npm run test:cap-update

# Clean database (remove non-tracked markets)
npm run cleanup:db
```

## Frontend Dashboard

### Technology Stack

- **React 18** with TypeScript
- **Vite** for fast dev server and builds
- **Native CSS** (no frameworks)

### Features

#### 1. Dashboard Overview

- Real borrower count across markets
- Active vault count
- Borrowers above/below APR caps
- Vaults with excess interest
- Today's earnings by token

#### 2. Market Breakdown

- Individual market statistics
- Current borrow rates vs. caps
- Total borrowed amounts
- Borrower counts per market

#### 3. Borrower List

- Paginated borrower directory
- Current debt and rates
- Market associations
- Status indicators

#### 4. Alerts Panel

- **Critical alerts** (≥3x cap) - Red
- **High alerts** (2-3x cap) - Orange
- Rate multiplier badges
- Market-specific warnings

#### 5. Positions Above Cap

- Detailed view of over-cap positions
- Rate comparison (current vs. cap)
- Excess interest calculations
- Color-coded severity

#### 6. Reimbursement Tracking

- **Pending Reimbursements**: Borrowers owed money
- **Vault Reimbursement Pool**: Excess by token (WETH, USDC)
- Total reimbursable amounts
- Market breakdown

### Setup & Run

```bash
# 1. Install dependencies
cd frontend
npm install

# 2. Start dev server
npm run dev

# Dashboard runs on http://localhost:5173
# Connects to backend at http://localhost:3000
```

### Build for Production

```bash
cd frontend
npm run build
npm run preview
```

## Key Concepts

### APR Caps

Each market has a configured APR cap (e.g., 12% for wstETH/WETH). When the actual borrow rate exceeds this cap, borrowers are reimbursed for the excess.

**Example:**

- Market rate: 18% APR
- APR cap: 12%
- Excess: 6% APR
- Borrower owes 18% but pays net 12% (after reimbursement)

### Vault Supply Interest

Company's vaults earn interest on supplied capital. The service tracks:

- Total interest earned per token
- Interest earned above the cap (excess that will be reimbursed to borrowers)
- Net earnings (total - excess)

### Reimbursement Flow

1. Daily job calculates interest above cap for each borrower
2. Creates `pending` reimbursement records in database
3. Vault reimbursement pool tracks total owed by token
4. **On-chain execution** (TODO): Vault contracts transfer tokens to borrowers
5. Reimbursement status updates to `processed`

### Token Awareness

Different markets use different loan assets:

- **wstETH/WETH**: Borrows and reimburses in **WETH**
- **WBTC/USDC**: Borrows and reimburses in **USDC**
- **WPOL/USDC**: Borrows and reimburses in **USDC**

All interest and reimbursement amounts are tracked and displayed with their respective token units.

## Environment Variables

### Backend (`backend/.env`)

```env
DATABASE_URL=postgresql://localhost/company
POLYGON_RPC=https://polygon-rpc.com
PORT=3000
```

### Frontend (`frontend/.env`)

```env
VITE_API_URL=http://localhost:3000
```

## Development Workflow

1. **Start Backend**: `cd backend && npm run dev`

   - Server auto-initializes (seeds if needed, syncs allocations)
   - Scheduler starts automatically
   - APIs available at `http://localhost:3000`

2. **Start Frontend**: `cd frontend && npm run dev`

   - Dashboard available at `http://localhost:5173`
   - Auto-refreshes on code changes

3. **Test Daily Job**: `POST http://localhost:3000/api/admin/trigger-daily-job`

4. **Monitor Logs**: Watch backend terminal for processing updates

## Production Deployment

### Backend

```bash
cd backend
npm run build
npm start
```

### Frontend

```bash
cd frontend
npm run build
# Serve dist/ with nginx, Vercel, or Netlify
```

### Database

- Use managed PostgreSQL (AWS RDS, DigitalOcean, etc.)
- Run migrations on production database
- Ensure connection string is secure

### Monitoring

- Backend logs include detailed processing summaries
- Health check endpoint: `GET /health`
- Consider adding Sentry or similar error tracking

## TODO / Future Enhancements

- [ ] **On-chain reimbursement execution**: Implement actual vault contract calls to transfer tokens
- [ ] **Email/Slack alerts**: Notify when rates exceed thresholds
- [ ] **Historical charts**: Visualize rate trends over time
- [ ] **Multi-chain support**: Extend to Ethereum mainnet, Base, etc.
- [ ] **Gas optimization**: Batch reimbursements to reduce transaction costs
- [ ] **Admin UI**: Web interface for updating APR caps and configurations

## License

MIT

## Support

For questions or issues, contact the Company team.
