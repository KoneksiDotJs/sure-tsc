import { describe, expect, it } from 'vitest';
import {
  addMoney,
  subMoney,
  mulMoney,
  divMoney,
  sumMoney,
  convertCurrency,
  evaluateAmountExpression,
  calculateLoanAmortization,
  calculateBudgetRollover,
  formatCurrency,
} from './decimal.js';
import {
  getLocaleConfig,
  translate,
  formatLocalizedDate,
} from '../i18n/locales.js';

describe('Decimal Monetary Arithmetic & Precision (NFR-1)', () => {
  it('avoids IEEE-754 floating point rounding errors (0.1 + 0.2)', () => {
    expect(addMoney('0.1000', '0.2000')).toBe('0.3000');
    expect(subMoney('1000.0000', '0.0001')).toBe('999.9999');
  });

  it('handles zero, negative values (refunds/outflows), and large balances', () => {
    expect(addMoney('0.0000', '-125.4500')).toBe('-125.4500');
    expect(addMoney('999999999999.9999', '0.0001')).toBe('1000000000000.0000');
    expect(sumMoney(['100.2500', '-40.1250', '19.8750'])).toBe('80.0000');
  });

  it('applies ROUND_HALF_EVEN (Banker rounding) on multiplication, division, and currency conversion', () => {
    expect(mulMoney('10.0000', '1.08255')).toBe('10.8255');
    expect(divMoney('100.0000', '3')).toBe('33.3333');
    // Banker's rounding test: 2.5 at 5th decimal place rounds to even 4th decimal
    expect(convertCurrency('1.0000', '1.12345')).toBe('1.1234');
    expect(convertCurrency('1.0000', '1.12355')).toBe('1.1236');
  });

  it('evaluates inline amount arithmetic expressions accurately (MoneyField)', () => {
    expect(evaluateAmountExpression('125000 + 15000 * 2')).toBe('155000.00');
    expect(evaluateAmountExpression('(45.50 + 12.25) / 2')).toBe('28.88');
    expect(evaluateAmountExpression('$1,200.50 - 200.25')).toBe('1000.25');
    expect(evaluateAmountExpression('invalid + abc')).toBeNull();
    expect(evaluateAmountExpression('100 / 0')).toBeNull();
  });

  it('calculates loan amortization schedule and extra-repayment savings', () => {
    const result = calculateLoanAmortization({
      principal: '300000.0000',
      annualInterestRatePercent: '6.0000',
      termMonths: 360,
      extraMonthlyPayment: '500.0000',
    });

    expect(result.monthlyScheduledPayment).toBe('1798.6516');
    expect(result.monthsSaved).toBeGreaterThan(100);
    expect(Number(result.interestSaved)).toBeGreaterThan(100000);
    expect(result.schedule[result.schedule.length - 1]?.remainingBalance).toBe('0.0000');
  });

  it('calculates monthly budget category rollover surpluses and deficits', () => {
    const surplus = calculateBudgetRollover({
      budgetedAmount: '500.0000',
      actualSpentAmount: '380.0000',
      previousRolloverBalance: '50.0000',
      rolloverEnabled: true,
    });
    expect(surplus.effectiveAvailable).toBe('550.0000');
    expect(surplus.remainingBalance).toBe('170.0000');
    expect(surplus.nextMonthRollover).toBe('170.0000');
    expect(surplus.isOverBudget).toBe(false);

    const deficit = calculateBudgetRollover({
      budgetedAmount: '400.0000',
      actualSpentAmount: '490.0000',
      previousRolloverBalance: '20.0000',
      rolloverEnabled: true,
    });
    expect(deficit.remainingBalance).toBe('-70.0000');
    expect(deficit.isOverBudget).toBe(true);
  });

  it('formats currency values with proper sign and thousand separators', () => {
    expect(formatCurrency('125430.5', 'USD')).toBe('$125,430.50');
    expect(formatCurrency('-42.1', 'USD')).toBe('-$42.10');
    expect(formatCurrency('89.99', 'EUR', { showSign: true })).toBe('+€89.99');
    expect(formatCurrency('1500000', 'IDR')).toBe('Rp1,500,000.00');
    expect(formatCurrency('1500000.5', 'IDR', { locale: 'id-ID' })).toBe('Rp1.500.000,50');
  });

  it('provides Indonesian localization defaults, translations, and date formatting', () => {
    const idConfig = getLocaleConfig('id-ID');
    expect(idConfig.code).toBe('id');
    expect(idConfig.defaultCurrency).toBe('IDR');
    expect(idConfig.defaultCountry).toBe('ID');
    expect(idConfig.dateFormat).toBe('DD/MM/YYYY');
    expect(translate('id', 'prefs.currencies.title')).toBe('Mata Uang Keluarga');
    expect(formatLocalizedDate('2026-11-15', idConfig.dateFormat)).toBe('15/11/2026');
  });
});
