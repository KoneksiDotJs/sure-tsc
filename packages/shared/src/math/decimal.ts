import Decimal from 'decimal.js';

// Configure globally per Non-Negotiable Invariant #1 (PRD NFR-1 & 01-architecture-and-domain.md)
Decimal.set({
  precision: 28,
  rounding: Decimal.ROUND_HALF_EVEN,
});

export { Decimal };

export type DecimalValue = string | Decimal;

export const DECIMAL_SCALE = 4;
export const DISPLAY_SCALE = 2;

export const DECIMAL_STRING_REGEX = /^-?\d+(\.\d{1,4})?$/;

/**
 * Converts a Decimal or string representation of money into a configured Decimal instance.
 * Native JS numbers are intentionally excluded from public financial signatures.
 */
export function toDecimal(value: DecimalValue): Decimal {
  if (value instanceof Decimal) {
    return value;
  }
  const cleaned = value.trim().replace(/,/g, '');
  if (!cleaned || isNaN(Number(cleaned))) {
    throw new Error(`Invalid decimal string: "${value}"`);
  }
  return new Decimal(cleaned);
}

/**
 * Formats a DecimalValue to a canonical 4-decimal string for PostgreSQL DECIMAL(19, 4) & JSON API serialization.
 */
export function toFixedDecimalString(value: DecimalValue, scale: number = DECIMAL_SCALE): string {
  return toDecimal(value).toFixed(scale, Decimal.ROUND_HALF_EVEN);
}

export function addMoney(a: DecimalValue, b: DecimalValue): string {
  return toDecimal(a).plus(toDecimal(b)).toFixed(DECIMAL_SCALE, Decimal.ROUND_HALF_EVEN);
}

export function subMoney(a: DecimalValue, b: DecimalValue): string {
  return toDecimal(a).minus(toDecimal(b)).toFixed(DECIMAL_SCALE, Decimal.ROUND_HALF_EVEN);
}

export function mulMoney(a: DecimalValue, factor: DecimalValue): string {
  return toDecimal(a).times(toDecimal(factor)).toFixed(DECIMAL_SCALE, Decimal.ROUND_HALF_EVEN);
}

export function divMoney(a: DecimalValue, divisor: DecimalValue): string {
  const d = toDecimal(divisor);
  if (d.isZero()) {
    throw new Error('Division by zero in monetary calculation');
  }
  return toDecimal(a).dividedBy(d).toFixed(DECIMAL_SCALE, Decimal.ROUND_HALF_EVEN);
}

export function sumMoney(values: DecimalValue[]): string {
  let acc = new Decimal(0);
  for (const v of values) {
    acc = acc.plus(toDecimal(v));
  }
  return acc.toFixed(DECIMAL_SCALE, Decimal.ROUND_HALF_EVEN);
}

export function absMoney(value: DecimalValue): string {
  return toDecimal(value).abs().toFixed(DECIMAL_SCALE, Decimal.ROUND_HALF_EVEN);
}

export function negateMoney(value: DecimalValue): string {
  return toDecimal(value).negated().toFixed(DECIMAL_SCALE, Decimal.ROUND_HALF_EVEN);
}

export function compareMoney(a: DecimalValue, b: DecimalValue): -1 | 0 | 1 {
  const cmp = toDecimal(a).comparedTo(toDecimal(b));
  if (cmp < 0) return -1;
  if (cmp > 0) return 1;
  return 0;
}

export function isZeroMoney(value: DecimalValue): boolean {
  return toDecimal(value).isZero();
}

export function isPositiveMoney(value: DecimalValue): boolean {
  return toDecimal(value).greaterThan(0);
}

export function isNegativeMoney(value: DecimalValue): boolean {
  return toDecimal(value).lessThan(0);
}

/**
 * Multi-currency conversion using ROUND_HALF_EVEN (Banker's Rounding).
 */
export function convertCurrency(amount: DecimalValue, exchangeRate: DecimalValue): string {
  return toDecimal(amount)
    .times(toDecimal(exchangeRate))
    .toFixed(DECIMAL_SCALE, Decimal.ROUND_HALF_EVEN);
}

/**
 * Safe inline arithmetic expression evaluator matching Sure's `evaluate_amount_expression.js`.
 * Supports expressions like "125000 + 15000 * 2" -> "155000.00" or "(45.50 + 12.25) / 2" -> "28.88"
 * Uses a recursive descent parser backed strictly by `Decimal` (no eval() or IEEE-754 floats).
 */
export function evaluateAmountExpression(
  rawExpression: string,
  scale: number = DISPLAY_SCALE
): string | null {
  const stripped = rawExpression
    .replace(/rp/gi, '')
    .replace(/[$€£¥₹,\s]/g, '')
    .trim();

  if (!stripped) return null;

  // Reject characters outside digits, decimal point, operators, and parentheses
  if (!/^[0-9.+\-*/()]+$/.test(stripped)) {
    return null;
  }

  let pos = 0;

  function peek(): string | undefined {
    return stripped[pos];
  }

  function consume(): string | undefined {
    return stripped[pos++];
  }

  function parseExpression(): Decimal {
    let left = parseTerm();
    while (peek() === '+' || peek() === '-') {
      const op = consume();
      const right = parseTerm();
      left = op === '+' ? left.plus(right) : left.minus(right);
    }
    return left;
  }

  function parseTerm(): Decimal {
    let left = parseFactor();
    while (peek() === '*' || peek() === '/') {
      const op = consume();
      const right = parseFactor();
      if (op === '/') {
        if (right.isZero()) {
          throw new Error('Division by zero');
        }
        left = left.dividedBy(right);
      } else {
        left = left.times(right);
      }
    }
    return left;
  }

  function parseFactor(): Decimal {
    if (peek() === '+') {
      consume();
      return parseFactor();
    }
    if (peek() === '-') {
      consume();
      return parseFactor().negated();
    }
    if (peek() === '(') {
      consume(); // '('
      const val = parseExpression();
      if (consume() !== ')') {
        throw new Error('Unmatched parenthesis');
      }
      return val;
    }

    const start = pos;
    let hasDot = false;
    while (pos < stripped.length) {
      const ch = stripped[pos]!;
      if (ch >= '0' && ch <= '9') {
        pos++;
      } else if (ch === '.' && !hasDot) {
        hasDot = true;
        pos++;
      } else {
        break;
      }
    }

    const numStr = stripped.slice(start, pos);
    if (!numStr || numStr === '.') {
      throw new Error('Expected number');
    }
    return new Decimal(numStr);
  }

  try {
    const result = parseExpression();
    if (pos !== stripped.length || !result.isFinite()) {
      return null;
    }
    return result.toFixed(scale, Decimal.ROUND_HALF_EVEN);
  } catch {
    return null;
  }
}

export interface AmortizationInstallment {
  month: number;
  payment: string;
  principalPaid: string;
  interestPaid: string;
  extraPayment: string;
  remainingBalance: string;
}

export interface LoanSimulationResult {
  monthlyScheduledPayment: string;
  totalInterestBaseline: string;
  totalInterestWithExtra: string;
  interestSaved: string;
  monthsSaved: number;
  payoffMonths: number;
  schedule: AmortizationInstallment[];
}

/**
 * Calculates loan amortization schedule and extra-repayment payoff simulation using Decimal.
 */
export function calculateLoanAmortization(params: {
  principal: DecimalValue;
  annualInterestRatePercent: DecimalValue;
  termMonths: number;
  extraMonthlyPayment?: DecimalValue;
}): LoanSimulationResult {
  const principalDec = toDecimal(params.principal);
  const annualRate = toDecimal(params.annualInterestRatePercent).dividedBy(100);
  const monthlyRate = annualRate.dividedBy(12);
  const n = params.termMonths;
  const extraDec = params.extraMonthlyPayment ? toDecimal(params.extraMonthlyPayment) : new Decimal(0);

  if (principalDec.lessThanOrEqualTo(0) || n <= 0) {
    return {
      monthlyScheduledPayment: '0.0000',
      totalInterestBaseline: '0.0000',
      totalInterestWithExtra: '0.0000',
      interestSaved: '0.0000',
      monthsSaved: 0,
      payoffMonths: 0,
      schedule: [],
    };
  }

  let scheduledPayment: Decimal;
  if (monthlyRate.isZero()) {
    scheduledPayment = principalDec.dividedBy(n);
  } else {
    // M = P * [r(1+r)^n] / [(1+r)^n - 1]
    const onePlusRPowerN = monthlyRate.plus(1).pow(n);
    scheduledPayment = principalDec
      .times(monthlyRate.times(onePlusRPowerN))
      .dividedBy(onePlusRPowerN.minus(1));
  }
  scheduledPayment = new Decimal(scheduledPayment.toFixed(DECIMAL_SCALE, Decimal.ROUND_HALF_EVEN));

  // Baseline interest without extra payments
  let baselineBalance = principalDec;
  let baselineTotalInterest = new Decimal(0);
  for (let m = 1; m <= n && baselineBalance.greaterThan(0); m++) {
    const interest = new Decimal(
      baselineBalance.times(monthlyRate).toFixed(DECIMAL_SCALE, Decimal.ROUND_HALF_EVEN)
    );
    baselineTotalInterest = baselineTotalInterest.plus(interest);
    const principalPortion = Decimal.min(baselineBalance, scheduledPayment.minus(interest));
    baselineBalance = baselineBalance.minus(principalPortion);
  }

  // Schedule with extra payments
  const schedule: AmortizationInstallment[] = [];
  let balance = principalDec;
  let totalInterestWithExtra = new Decimal(0);
  let month = 0;

  while (balance.greaterThan(new Decimal('0.0001')) && month < n * 2) {
    month++;
    const interest = new Decimal(
      balance.times(monthlyRate).toFixed(DECIMAL_SCALE, Decimal.ROUND_HALF_EVEN)
    );
    let payment = scheduledPayment;
    let principalPortion = payment.minus(interest);
    let appliedExtra = extraDec;

    if (principalPortion.plus(appliedExtra).greaterThanOrEqualTo(balance)) {
      principalPortion = balance;
      appliedExtra = new Decimal(0);
      payment = principalPortion.plus(interest);
    }

    const totalPrincipalReduction = principalPortion.plus(appliedExtra);
    balance = Decimal.max(new Decimal(0), balance.minus(totalPrincipalReduction));
    totalInterestWithExtra = totalInterestWithExtra.plus(interest);

    schedule.push({
      month,
      payment: payment.plus(appliedExtra).toFixed(DECIMAL_SCALE, Decimal.ROUND_HALF_EVEN),
      principalPaid: totalPrincipalReduction.toFixed(DECIMAL_SCALE, Decimal.ROUND_HALF_EVEN),
      interestPaid: interest.toFixed(DECIMAL_SCALE, Decimal.ROUND_HALF_EVEN),
      extraPayment: appliedExtra.toFixed(DECIMAL_SCALE, Decimal.ROUND_HALF_EVEN),
      remainingBalance: balance.toFixed(DECIMAL_SCALE, Decimal.ROUND_HALF_EVEN),
    });
  }

  const interestSaved = Decimal.max(
    new Decimal(0),
    baselineTotalInterest.minus(totalInterestWithExtra)
  );

  return {
    monthlyScheduledPayment: scheduledPayment.toFixed(DECIMAL_SCALE, Decimal.ROUND_HALF_EVEN),
    totalInterestBaseline: baselineTotalInterest.toFixed(DECIMAL_SCALE, Decimal.ROUND_HALF_EVEN),
    totalInterestWithExtra: totalInterestWithExtra.toFixed(DECIMAL_SCALE, Decimal.ROUND_HALF_EVEN),
    interestSaved: interestSaved.toFixed(DECIMAL_SCALE, Decimal.ROUND_HALF_EVEN),
    monthsSaved: Math.max(0, n - month),
    payoffMonths: month,
    schedule,
  };
}

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

/**
 * Formats a Decimal string into a human-readable currency string for display.
 * Respects Indonesian (`id` / `id-ID`) `.` thousand & `,` decimal separators when requested.
 */
export function formatCurrency(
  amount: DecimalValue,
  currency: string = 'USD',
  options?: { showSign?: boolean; compact?: boolean; locale?: string }
): string {
  const dec = toDecimal(amount);
  const isNeg = dec.isNegative();
  const absDec = dec.abs();
  const code = currency.toUpperCase();
  const localeBase = options?.locale?.trim().toLowerCase().split(/[-_]/)[0];
  const isIndonesianFormat = localeBase === 'id' || localeBase === 'de' || localeBase === 'es' || localeBase === 'fr';
  const thousandSep = isIndonesianFormat ? '.' : ',';
  const decimalSep = isIndonesianFormat ? ',' : '.';

  const fixed = absDec.toFixed(DISPLAY_SCALE, Decimal.ROUND_HALF_EVEN);
  const [intPart = '0', fracPart = '00'] = fixed.split('.');

  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, thousandSep);
  const symbols: Record<string, string> = {
    USD: '$',
    IDR: 'Rp',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
    CNY: 'CN¥',
    SGD: 'S$',
    CAD: 'CA$',
    AUD: 'A$',
    CHF: 'CHF ',
  };
  const symbol = symbols[code] ?? `${code} `;

  let signPrefix = '';
  if (isNeg) {
    signPrefix = '-';
  } else if (options?.showSign && dec.greaterThan(0)) {
    signPrefix = '+';
  }

  return `${signPrefix}${symbol}${formattedInt}${decimalSep}${fracPart}`;
}
