import { describe, expect, it } from 'vitest';
import { BalanceService } from './balance.service.js';

describe('BalanceService — Forward & Reverse Calculators (FR-2.3)', () => {
  it('ForwardCalculator: computes cumulative daily balances from opening valuation and cash flows', () => {
    const series = BalanceService.computeDailySeries({
      startDate: '2026-11-01',
      endDate: '2026-11-04',
      entries: [
        {
          date: '2026-11-01',
          amount: '1000.0000',
          entryType: 'VALUATION',
          valuationKind: 'OPENING',
          parentEntryId: null,
        },
        {
          date: '2026-11-02',
          amount: '-150.2500',
          entryType: 'TRANSACTION',
          parentEntryId: null,
        },
        {
          date: '2026-11-03',
          amount: '500.0000',
          entryType: 'TRANSACTION',
          parentEntryId: null,
        },
      ],
    });

    expect(series).toEqual([
      { date: '2026-11-01', balance: '1000.0000' },
      { date: '2026-11-02', balance: '849.7500' },
      { date: '2026-11-03', balance: '1349.7500' },
      { date: '2026-11-04', balance: '1349.7500' },
    ]);
  });

  it('ReverseCalculator: anchors to RECONCILIATION valuation and calculates backwards accurately', () => {
    // Suppose on 2026-11-03 the reconciled balance is 2000.0000,
    // and on 2026-11-02 there was a -200.0000 outflow, and on 2026-11-03 a +300.0000 inflow:
    // Then 2026-11-02 EOD must have been 2000 - 300 = 1700.0000,
    // and 2026-11-01 EOD must have been 1700 - (-200) = 1900.0000.
    const series = BalanceService.computeDailySeries({
      startDate: '2026-11-01',
      endDate: '2026-11-04',
      entries: [
        {
          date: '2026-11-02',
          amount: '-200.0000',
          entryType: 'TRANSACTION',
          parentEntryId: null,
        },
        {
          date: '2026-11-03',
          amount: '300.0000',
          entryType: 'TRANSACTION',
          parentEntryId: null,
        },
        {
          date: '2026-11-03',
          amount: '2000.0000',
          entryType: 'VALUATION',
          valuationKind: 'RECONCILIATION',
          parentEntryId: null,
        },
        {
          date: '2026-11-04',
          amount: '-50.0000',
          entryType: 'TRANSACTION',
          parentEntryId: null,
        },
      ],
    });

    expect(series).toEqual([
      { date: '2026-11-01', balance: '1900.0000' },
      { date: '2026-11-02', balance: '1700.0000' },
      { date: '2026-11-03', balance: '2000.0000' },
      { date: '2026-11-04', balance: '1950.0000' },
    ]);
  });

  it('LiabilityCalculator: charges (negative outflows) increase debt and payments (positive inflows) reduce debt', () => {
    const series = BalanceService.computeDailySeries({
      classification: 'LIABILITY',
      startDate: '2026-11-01',
      endDate: '2026-11-03',
      entries: [
        {
          date: '2026-11-01',
          amount: '1000.0000',
          entryType: 'VALUATION',
          valuationKind: 'OPENING',
          parentEntryId: null,
        },
        {
          date: '2026-11-02',
          amount: '-250.0000',
          entryType: 'TRANSACTION',
          parentEntryId: null,
        },
        {
          date: '2026-11-03',
          amount: '400.0000',
          entryType: 'TRANSACTION',
          parentEntryId: null,
        },
      ],
    });

    expect(series).toEqual([
      { date: '2026-11-01', balance: '1000.0000' },
      { date: '2026-11-02', balance: '1250.0000' },
      { date: '2026-11-03', balance: '850.0000' },
    ]);
  });
});
