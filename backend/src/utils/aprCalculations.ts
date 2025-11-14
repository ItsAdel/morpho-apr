export class APRCalculator {
  /**
   * Calculate daily interest accrued
   * @param principal The principal amount
   * @param aprRate Annual percentage rate (decimal, e.g., 0.15 for 15%)
   * @param days Number of days
   */
  static calculateDailyInterest(
    principal: number,
    aprRate: number,
    days: number = 1
  ): number {
    // Simple interest: (Principal * Rate * Time) / 365
    return (principal * aprRate * days) / 365;
  }

  /**
   * Calculate reimbursement amount (interest above cap)
   */
  static calculateReimbursement(
    principal: number,
    actualRate: number,
    cappedRate: number,
    days: number = 1
  ): number {
    if (actualRate <= cappedRate) return 0;

    const actualInterest = this.calculateDailyInterest(
      principal,
      actualRate,
      days
    );
    const cappedInterest = this.calculateDailyInterest(
      principal,
      cappedRate,
      days
    );

    return actualInterest - cappedInterest;
  }

  /**
   * Convert APY to APR (approximate)
   */
  static apyToApr(apy: number): number {
    // Simplified conversion: APR ≈ ln(1 + APY)
    return Math.log(1 + apy);
  }
}
