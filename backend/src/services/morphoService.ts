import { ethers } from "ethers";

// Simplified Morpho Vault ABI (you'll need the full one)
const MORPHO_VAULT_ABI = [
  "function totalAssets() view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  // Add more methods as needed from Morpho docs
];

export class MorphoService {
  private provider: ethers.Provider;

  constructor(rpcUrl: string) {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
  }

  async getMarketData(vaultAddress: string, marketId: string) {
    // Query Morpho contract or use their API
    // Example using contract:
    const vault = new ethers.Contract(
      vaultAddress,
      MORPHO_VAULT_ABI,
      this.provider
    );

    // Fetch market state
    // This is simplified - you'll need to adapt to actual Morpho contract structure
    const totalAssets = await vault.totalAssets();
    const totalSupply = await vault.totalSupply();

    return {
      totalAssets: ethers.formatEther(totalAssets),
      totalSupply: ethers.formatEther(totalSupply),
      // Add borrowers, rates, etc.
    };
  }

  /**
   * Get market state (APY, total borrow/supply assets)
   */
  async getMarketState(marketId: string): Promise<any> {
    const response = await fetch("https://blue-api.morpho.org/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `
          query GetMarketState($marketId: String!) {
            marketByUniqueKey(uniqueKey: $marketId, chainId: 137) {
              uniqueKey
              loanAsset {
                address
                symbol
                decimals
              }
              collateralAsset {
                address
                symbol
                decimals
              }
              state {
                borrowApy
                supplyApy
                borrowAssets
                supplyAssets
                borrowShares
                supplyShares
              }
            }
          }
        `,
        variables: { marketId },
      }),
    });

    const data = (await response.json()) as any;

    if (data.errors) {
      throw new Error(
        `GraphQL error: ${data.errors[0]?.message || "Unknown error"}`
      );
    }

    if (!data.data || !data.data.marketByUniqueKey) {
      throw new Error(`No market data for marketId: ${marketId}`);
    }

    return data.data.marketByUniqueKey;
  }

  /**
   * Get individual borrower positions for a market
   * Returns users with borrowShares > 0 (actual borrowers)
   */
  async getBorrowerPositions(
    marketId: string,
    limit: number = 50
  ): Promise<any[]> {
    const response = await fetch("https://blue-api.morpho.org/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `
          query GetMarketBorrowers($marketId: String!, $chainId: Int!, $limit: Int!) {
            marketPositions(
              where: {
                marketUniqueKey_in: [$marketId]
                chainId_in: [$chainId]
              }
              first: $limit
            ) {
              items {
                user {
                  address
                }
                supplyShares
                borrowShares
                market {
                  uniqueKey
                  loanAsset {
                    symbol
                    decimals
                  }
                  collateralAsset {
                    symbol
                    decimals
                  }
                  state {
                    borrowAssets
                    borrowShares
                  }
                }
              }
            }
          }
        `,
        variables: {
          marketId,
          chainId: 137,
          limit,
        },
      }),
    });

    const data = (await response.json()) as any;

    if (data.errors) {
      throw new Error(
        `GraphQL error: ${data.errors[0]?.message || "Unknown error"}`
      );
    }

    if (!data.data || !data.data.marketPositions) {
      return [];
    }

    // Filter for actual borrowers (borrowShares > 0)
    const borrowers = data.data.marketPositions.items.filter(
      (position: any) => BigInt(position.borrowShares) > 0n
    );

    // Calculate actual borrowed amount from shares
    return borrowers.map((position: any) => {
      const borrowShares = BigInt(position.borrowShares);
      const totalBorrowShares = BigInt(position.market.state.borrowShares);
      const totalBorrowAssets = BigInt(position.market.state.borrowAssets);

      // Calculate: borrowedAmount = (userBorrowShares * totalBorrowAssets) / totalBorrowShares
      let borrowedAmount = "0";
      if (totalBorrowShares > 0n) {
        borrowedAmount = ethers.formatEther(
          (borrowShares * totalBorrowAssets) / totalBorrowShares
        );
      }

      return {
        address: position.user.address,
        borrowShares: position.borrowShares,
        borrowedAmount: borrowedAmount,
        loanAsset: position.market.loanAsset.symbol,
        collateralAsset: position.market.collateralAsset.symbol,
        marketId: position.market.uniqueKey,
      };
    });
  }

  /**
   * Backward compatibility - renamed to getMarketState
   */
  async getBorrowerPositions_OLD(marketId: string): Promise<any[]> {
    const marketState = await this.getMarketState(marketId);
    return [marketState];
  }

  /**
   * Seed initial data (vaults, markets, vault allocations)
   * This replaces the seedFromMorpho script logic
   */
  async seedInitialData(pool: any): Promise<void> {
    console.log("🌱 Seeding database with real Morpho data...\n");

    // 1. Seed Vaults
    console.log("📦 Seeding vaults...");
    const vaults = [
      {
        address: "0xAcB0DCe4b0FF400AD8F6917f3ca13E434C9ed6bC",
        name: "Steakhouse High Yield USDC",
        symbol: "bbqUSDC",
      },
      {
        address: "0xF5C81d25ee174d83f1FD202cA94AE6070d073cCF",
        name: "Compound WETH",
        symbol: "compWETH",
      },
      {
        address: "0xfD06859A671C21497a2EB8C5E3fEA48De924D6c8",
        name: "Compound USDT",
        symbol: "compUSDT",
      },
    ];

    for (const vault of vaults) {
      await pool.query(
        `
        INSERT INTO vaults (address, name, symbol)
        VALUES ($1, $2, $3)
        ON CONFLICT (address) DO UPDATE SET
          name = $2,
          symbol = $3
      `,
        [vault.address, vault.name, vault.symbol]
      );
      console.log(`  ✅ ${vault.name}`);
    }

    // 2. Seed Markets
    console.log("\n📊 Seeding markets...");
    const markets = [
      {
        market_id:
          "0x7506b33817b57f686e37b87b5d4c5c93fdef4cffd21bbf9291f18b2f29ab0550",
        name: "WPOL/USDC 77% LLTV",
        collateral_asset: "WPOL",
        loan_asset: "USDC",
        lltv: 0.77,
        apr_cap: 0.15,
      },
      {
        market_id:
          "0x1cfe584af3db05c7f39d60e458a87a8b2f6b5d8c6125631984ec489f1d13553b",
        name: "WBTC/USDC 86% LLTV",
        collateral_asset: "WBTC",
        loan_asset: "USDC",
        lltv: 0.86,
        apr_cap: 0.1,
      },
      {
        market_id:
          "0xb8ae474af3b91c8143303723618b31683b52e9c86566aa54c06f0bc27906bcae",
        name: "wstETH/WETH 91.5% LLTV",
        collateral_asset: "wstETH",
        loan_asset: "WETH",
        lltv: 0.915,
        apr_cap: 0.12,
      },
    ];

    for (const market of markets) {
      await pool.query(
        `
        INSERT INTO markets (market_id, name, collateral_asset, loan_asset, lltv, apr_cap, alert_threshold)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (market_id) DO UPDATE SET
          name = $2,
          collateral_asset = $3,
          loan_asset = $4,
          lltv = $5,
          apr_cap = $6,
          alert_threshold = $7
      `,
        [
          market.market_id,
          market.name,
          market.collateral_asset,
          market.loan_asset,
          market.lltv,
          market.apr_cap,
          market.apr_cap * 2,
        ]
      );
      console.log(`  ✅ ${market.name}`);
    }

    // 3. Fetch and seed vault allocations from Morpho API
    console.log("\n🔗 Fetching vault allocations from Morpho API...");
    await this.syncVaultAllocations(pool);

    console.log("\n✨ Seeding complete!\n");
  }

  /**
   * Fetch vault allocations from Morpho API and sync to database
   */
  async syncVaultAllocations(pool: any): Promise<void> {
    // Get all vaults from database
    const vaultsResult = await pool.query(
      "SELECT id, address, name FROM vaults"
    );
    const vaults = vaultsResult.rows;

    // Get tracked markets
    const marketsResult = await pool.query("SELECT market_id FROM markets");
    const trackedMarketIds = marketsResult.rows.map((m: any) => m.market_id);

    let totalAllocations = 0;

    for (const vault of vaults) {
      console.log(`  📦 ${vault.name}`);

      try {
        const allocations = await this.getVaultAllocations(vault.address);

        // Filter for only our tracked markets
        const relevantAllocations = allocations.filter((alloc: any) =>
          trackedMarketIds.includes(alloc.market.uniqueKey)
        );

        if (relevantAllocations.length === 0) {
          console.log(`     ⏭️  No allocations to tracked markets`);
          continue;
        }

        for (const alloc of relevantAllocations) {
          const supplyAssets = parseFloat(alloc.supplyAssets);
          const supplyAssetsUsd = parseFloat(alloc.supplyAssetsUsd || "0");

          await pool.query(
            `
            INSERT INTO vault_allocations (vault_id, market_id, supply_assets, supply_assets_usd)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (vault_id, market_id) DO UPDATE SET
              supply_assets = $3,
              supply_assets_usd = $4,
              last_updated = NOW()
          `,
            [vault.id, alloc.market.uniqueKey, supplyAssets, supplyAssetsUsd]
          );

          console.log(
            `     ✅ ${alloc.market.loanAsset.symbol}: ${supplyAssets.toFixed(
              6
            )} (${supplyAssetsUsd.toFixed(2)} USD)`
          );
          totalAllocations++;
        }
      } catch (error: any) {
        console.error(`     ❌ Error fetching allocations: ${error.message}`);
      }
    }

    console.log(`  ✅ Synced ${totalAllocations} vault allocations`);
  }

  /**
   * Get vault allocations from Morpho GraphQL API
   */
  async getVaultAllocations(vaultAddress: string): Promise<any[]> {
    const response = await fetch("https://blue-api.morpho.org/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `
          query GetVaultAllocations($vaultAddress: String!) {
            vaultByAddress(address: $vaultAddress, chainId: 137) {
              address
              name
              allocations {
                market {
                  uniqueKey
                  loanAsset {
                    symbol
                  }
                  collateralAsset {
                    symbol
                  }
                }
                supplyAssets
                supplyAssetsUsd
                supplyShares
              }
            }
          }
        `,
        variables: {
          vaultAddress: vaultAddress.toLowerCase(),
        },
      }),
    });

    const data = (await response.json()) as any;

    if (data.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
    }

    if (!data.data?.vaultByAddress) {
      return [];
    }

    return data.data.vaultByAddress.allocations || [];
  }

  /**
   * Sync borrowers from Morpho markets
   * This replaces the syncRealBorrowers script logic
   */
  async syncBorrowers(pool: any): Promise<void> {
    console.log("=".repeat(70));
    console.log("         SYNC REAL BORROWER POSITIONS FROM MORPHO");
    console.log("=".repeat(70));
    console.log("\n");

    const marketsResult = await pool.query(
      "SELECT market_id, name FROM markets"
    );
    console.log(`📊 Found ${marketsResult.rows.length} markets to process\n`);

    let totalBorrowersFound = 0;
    let totalBorrowersCreated = 0;
    let totalBorrowersUpdated = 0;

    for (const market of marketsResult.rows) {
      console.log(`🔍 Processing market: ${market.name}`);
      console.log(`   Market ID: ${market.market_id}`);

      try {
        const borrowers = await this.getBorrowerPositions(
          market.market_id,
          100
        );
        console.log(`   Found ${borrowers.length} borrowers\n`);
        totalBorrowersFound += borrowers.length;

        if (borrowers.length === 0) {
          console.log("   ⏭️  No borrowers in this market\n");
          continue;
        }

        for (const borrower of borrowers) {
          try {
            const borrowerResult = await pool.query(
              `
              INSERT INTO borrowers (address)
              VALUES ($1)
              ON CONFLICT (address) DO NOTHING
              RETURNING id
              `,
              [borrower.address]
            );

            let borrowerId;
            if (borrowerResult.rows.length > 0) {
              borrowerId = borrowerResult.rows[0].id;
            } else {
              const existingBorrower = await pool.query(
                "SELECT id FROM borrowers WHERE address = $1",
                [borrower.address]
              );
              borrowerId = existingBorrower.rows[0].id;
            }

            const existingPosition = await pool.query(
              `
              SELECT id, current_debt FROM borrower_positions
              WHERE borrower_id = $1 AND market_id = $2 AND vault_id IS NULL
              `,
              [borrowerId, market.market_id]
            );

            if (existingPosition.rows.length > 0) {
              await pool.query(
                `
                UPDATE borrower_positions
                SET current_debt = $1,
                    principal_borrowed = $2,
                    updated_at = NOW(),
                    status = 'active'
                WHERE id = $3
                `,
                [
                  borrower.borrowedAmount,
                  borrower.borrowedAmount,
                  existingPosition.rows[0].id,
                ]
              );
              totalBorrowersUpdated++;
              console.log(
                `   ✏️  Updated position for ${borrower.address.slice(
                  0,
                  10
                )}...`
              );
            } else {
              await pool.query(
                `
                INSERT INTO borrower_positions (
                  borrower_id,
                  market_id,
                  principal_borrowed,
                  current_debt,
                  opened_at,
                  status
                ) VALUES ($1, $2, $3, $4, NOW(), 'active')
                `,
                [
                  borrowerId,
                  market.market_id,
                  borrower.borrowedAmount,
                  borrower.borrowedAmount,
                ]
              );
              totalBorrowersCreated++;
              console.log(
                `   ✅ Created position for ${borrower.address.slice(0, 10)}...`
              );
            }
          } catch (error: any) {
            console.error(
              `   ❌ Error processing borrower ${borrower.address}:`,
              error.message
            );
          }
        }

        console.log("");
      } catch (error: any) {
        console.error(
          `❌ Error fetching borrowers for market ${market.name}:`,
          error.message
        );
        console.log("");
      }
    }

    console.log("\n" + "=".repeat(70));
    console.log("✅ SYNC COMPLETE");
    console.log("=".repeat(70));
    console.log(`📊 Total borrowers found: ${totalBorrowersFound}`);
    console.log(`✅ New positions created: ${totalBorrowersCreated}`);
    console.log(`✏️  Existing positions updated: ${totalBorrowersUpdated}`);
    console.log("\n");
  }
}
