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
