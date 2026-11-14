import {
  addMoney,
  subMoney,
  negateMoney,
  convertCurrency,
  toFixedDecimalString,
} from '@sure/shared';
import {
  prisma,
  decimalToFixed,
  getExchangeRate,
  parseIsoDate,
  toIsoDate,
} from '../../config/prisma.js';

export interface DailySeriesEntryInput {
  date: string;
  amount: string;
  entryType: 'TRANSACTION' | 'VALUATION' | 'TRADE';
  valuationKind?: string;
  parentEntryId: string | null;
}

export interface AccountBalanceSnapshotDto {
  id: string;
  accountId: string;
  date: string;
  balance: string;
  balanceInFamilyCurrency: string;
  currency: string;
}

/**
 * Balance Calculation & Materialization Engine (`BalanceService`)
 * Replicates Sure's `ForwardCalculator`, `ReverseCalculator`, and `Materializer`
 * per FR-2.3 & `docs/llm-guides/01-architecture-and-domain.md`.
 */
export class BalanceService {
  /**
   * Computes daily balances for a sequence of entries using Forward or Reverse calculation:
   * - If a RECONCILIATION valuation exists, anchors to the latest reconciliation valuation
   *   and calculates backwards (`ReverseCalculator`) for dates prior to the anchor,
   *   and forwards (`ForwardCalculator`) for dates after the anchor.
   * - Otherwise, starts from the earliest OPENING/MARKET valuation (or '0.0000')
   *   and cumulatively adds daily net TRANSACTION / TRADE flows (`ForwardCalculator`).
   */
  public static computeDailySeries(params: {
    entries: DailySeriesEntryInput[];
    classification?: 'ASSET' | 'LIABILITY';
    initialBalance?: string;
    startDate?: string;
    endDate?: string;
  }): Array<{ date: string; balance: string }> {
    const activeEntries = params.entries;
    const isLiability = params.classification === 'LIABILITY';
    const applyFlow = (flow: string) => (isLiability ? negateMoney(flow) : flow);

    if (activeEntries.length === 0) {
      const today = params.endDate ?? new Date().toISOString().slice(0, 10);
      const init = toFixedDecimalString(params.initialBalance ?? '0.0000');
      return [{ date: today, balance: init }];
    }

    const sortedEntries = [...activeEntries].sort((a, b) => a.date.localeCompare(b.date));
    const minDate = params.startDate ?? sortedEntries[0]!.date;
    const todayIso = new Date().toISOString().slice(0, 10);
    const maxEntryDate = sortedEntries[sortedEntries.length - 1]!.date;
    const maxDate =
      params.endDate ?? (maxEntryDate > todayIso ? maxEntryDate : todayIso);

    const allDates = BalanceService.generateDateRange(minDate, maxDate);

    const netFlowByDate = new Map<string, string>();
    const valuationByDate = new Map<string, { amount: string; kind: string }>();

    for (const entry of sortedEntries) {
      if (entry.entryType === 'VALUATION') {
        valuationByDate.set(entry.date, {
          amount: toFixedDecimalString(entry.amount),
          kind: entry.valuationKind ?? 'RECONCILIATION',
        });
      } else {
        if (entry.parentEntryId) continue;
        const prev = netFlowByDate.get(entry.date) ?? '0.0000';
        netFlowByDate.set(entry.date, addMoney(prev, entry.amount));
      }
    }

    const reconciliationDates = Array.from(valuationByDate.entries())
      .filter(([, v]) => v.kind === 'RECONCILIATION')
      .map(([d]) => d)
      .sort();

    const dailyBalances = new Map<string, string>();

    if (reconciliationDates.length > 0) {
      const anchorDate = reconciliationDates[reconciliationDates.length - 1]!;
      const anchorBalance = valuationByDate.get(anchorDate)!.amount;
      const anchorIdx = allDates.indexOf(anchorDate);

      if (anchorIdx !== -1) {
        dailyBalances.set(anchorDate, anchorBalance);

        let runningBack = anchorBalance;
        for (let i = anchorIdx; i > 0; i--) {
          const currDate = allDates[i]!;
          const prevDate = allDates[i - 1]!;
          const explicitVal = valuationByDate.get(prevDate);
          if (explicitVal) {
            runningBack = explicitVal.amount;
          } else {
            const flowOnCurrDate = applyFlow(netFlowByDate.get(currDate) ?? '0.0000');
            runningBack = subMoney(runningBack, flowOnCurrDate);
          }
          dailyBalances.set(prevDate, runningBack);
        }

        let runningForward = anchorBalance;
        for (let i = anchorIdx + 1; i < allDates.length; i++) {
          const currDate = allDates[i]!;
          const explicitVal = valuationByDate.get(currDate);
          if (explicitVal) {
            runningForward = explicitVal.amount;
          } else {
            const flowOnCurrDate = applyFlow(netFlowByDate.get(currDate) ?? '0.0000');
            runningForward = addMoney(runningForward, flowOnCurrDate);
          }
          dailyBalances.set(currDate, runningForward);
        }
      }
    } else {
      let running = toFixedDecimalString(params.initialBalance ?? '0.0000');
      for (const date of allDates) {
        const explicitVal = valuationByDate.get(date);
        const flow = applyFlow(netFlowByDate.get(date) ?? '0.0000');
        if (explicitVal) {
          running = addMoney(explicitVal.amount, flow);
        } else {
          running = addMoney(running, flow);
        }
        dailyBalances.set(date, running);
      }
    }

    return allDates.map((date) => ({
      date,
      balance: dailyBalances.get(date) ?? '0.0000',
    }));
  }

  /**
   * Materializes daily end-of-day balances in `account_balances` (PostgreSQL) and updates `Account.balance`.
   * Always scopes by `familyId`.
   */
  public static async materializeAccount(
    familyId: string,
    accountId: string
  ): Promise<{ currentBalance: string; snapshotsCount: number }> {
    const account = await prisma.account.findFirst({
      where: { id: accountId, familyId },
      include: { family: true },
    });
    if (!account) {
      throw new Error(`Account ${accountId} not found for family ${familyId}`);
    }

    const fxRate = await getExchangeRate(account.currency, account.family.baseCurrency);

    const dbEntries = await prisma.entry.findMany({
      where: { familyId, accountId },
      include: { valuation: true },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    });

    const seriesInputs: DailySeriesEntryInput[] = dbEntries.map((e) => ({
      date: toIsoDate(e.date),
      amount: decimalToFixed(e.amount),
      entryType: e.entryType,
      valuationKind: e.valuation?.kind,
      parentEntryId: e.parentEntryId,
    }));

    const series = BalanceService.computeDailySeries({
      entries: seriesInputs,
      classification: account.classification,
      initialBalance: '0.0000',
    });

    const latestBalance =
      series.length > 0 ? series[series.length - 1]!.balance : '0.0000';

    await prisma.$transaction(async (tx) => {
      await tx.accountBalance.deleteMany({
        where: { accountId },
      });

      if (series.length > 0) {
        await tx.accountBalance.createMany({
          data: series.map((point) => ({
            accountId,
            date: parseIsoDate(point.date),
            balance: point.balance,
            balanceInFamilyCurrency: convertCurrency(point.balance, fxRate),
            currency: account.currency,
          })),
        });
      }

      await tx.account.update({
        where: { id: accountId },
        data: { balance: latestBalance },
      });
    });

    return {
      currentBalance: latestBalance,
      snapshotsCount: series.length,
    };
  }

  public static async getAccountSnapshots(
    familyId: string,
    accountId: string
  ): Promise<AccountBalanceSnapshotDto[]> {
    const account = await prisma.account.findFirst({
      where: { id: accountId, familyId },
      select: { id: true },
    });
    if (!account) return [];

    const rows = await prisma.accountBalance.findMany({
      where: { accountId },
      orderBy: { date: 'asc' },
    });

    return rows.map((r) => ({
      id: r.id,
      accountId: r.accountId,
      date: toIsoDate(r.date),
      balance: decimalToFixed(r.balance),
      balanceInFamilyCurrency: decimalToFixed(r.balanceInFamilyCurrency),
      currency: r.currency,
    }));
  }

  private static generateDateRange(startIso: string, endIso: string): string[] {
    const dates: string[] = [];
    const curr = new Date(`${startIso}T00:00:00.000Z`);
    const end = new Date(`${endIso}T00:00:00.000Z`);

    let guard = 0;
    while (curr <= end && guard < 730) {
      dates.push(curr.toISOString().slice(0, 10));
      curr.setUTCDate(curr.getUTCDate() + 1);
      guard++;
    }
    if (dates.length === 0) {
      dates.push(startIso);
    }
    return dates;
  }
}
