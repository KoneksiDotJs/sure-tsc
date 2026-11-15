import { CURRENCY_SYMBOL_MAP } from '../i18n/currencies.js';
import { Decimal, DISPLAY_SCALE, DecimalValue, toDecimal } from './core.js';

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
  const isEuroDotFormat =
    localeBase === 'id' || localeBase === 'de' || localeBase === 'es' || localeBase === 'fr';
  const thousandSep = isEuroDotFormat ? '.' : ',';
  const decimalSep = isEuroDotFormat ? ',' : '.';

  const fixed = absDec.toFixed(DISPLAY_SCALE, Decimal.ROUND_HALF_EVEN);
  const [intPart = '0', fracPart = '00'] = fixed.split('.');

  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, thousandSep);
  const symbol = CURRENCY_SYMBOL_MAP[code] ?? `${code} `;

  let signPrefix = '';
  if (isNeg) {
    signPrefix = '-';
  } else if (options?.showSign && dec.greaterThan(0)) {
    signPrefix = '+';
  }

  return `${signPrefix}${symbol}${formattedInt}${decimalSep}${fracPart}`;
}
