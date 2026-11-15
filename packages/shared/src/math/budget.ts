import { Decimal, DECIMAL_SCALE, DecimalValue, toDecimal } from './core.js';

/**
 * Calculates monthly budget category rollover (`RolloverCalculator` per FR-4.1).
 * Carries unspent surpluses or overspent deficits into subsequent months when rolloverEnabled is true.
 */
export function calculateBudgetRollover(params: {
  budgetedAmount: DecimalValue;
  actualSpentAmount: DecimalValue;
  previousRolloverBalance: DecimalValue;
  rolloverEnabled: boolean;
}): {
  effectiveAvailable: string;
  remainingBalance: string;
  nextMonthRollover: string;
  utilizationPercent: string;
  isOverBudget: boolean;
} {
  const budgeted = toDecimal(params.budgetedAmount);
  const actualSpent = toDecimal(params.actualSpentAmount);
  const prevRollover = params.rolloverEnabled ? toDecimal(params.previousRolloverBalance) : new Decimal(0);

  const effectiveAvailable = budgeted.plus(prevRollover);
  const remaining = effectiveAvailable.minus(actualSpent);
  const nextMonthRollover = params.rolloverEnabled ? remaining : new Decimal(0);

  let utilization = new Decimal(0);
  if (effectiveAvailable.greaterThan(0)) {
    utilization = actualSpent.dividedBy(effectiveAvailable).times(100);
  } else if (actualSpent.greaterThan(0)) {
    utilization = new Decimal(100);
  }

  return {
    effectiveAvailable: effectiveAvailable.toFixed(DECIMAL_SCALE, Decimal.ROUND_HALF_EVEN),
    remainingBalance: remaining.toFixed(DECIMAL_SCALE, Decimal.ROUND_HALF_EVEN),
    nextMonthRollover: nextMonthRollover.toFixed(DECIMAL_SCALE, Decimal.ROUND_HALF_EVEN),
    utilizationPercent: utilization.toFixed(2, Decimal.ROUND_HALF_EVEN),
    isOverBudget: remaining.lessThan(0),
  };
}
