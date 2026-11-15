import {
  AccountType,
  addMoney,
  mulMoney,
  subMoney,
} from '@sure/shared';
import { WebAccount, WebEntry } from '../../../lib/ledger-context.js';

export type TimeframeKey = '30D' | '3M' | '6M' | 'YTD' | '1Y' | 'ALL';
export type AccountSubTab = 'activity' | 'statements' | 'holdings' | 'loan';

export const ACCOUNT_TYPES: AccountType[] = [
  'DEPOSITORY',
  'CREDIT_CARD',
  'INVESTMENT',
  'CRYPTO',
  'PROPERTY',
  'VEHICLE',
  'LOAN',
  'OTHER_ASSET',
  'OTHER_LIABILITY',
];

export const TIMEFRAME_LABELS: Record<TimeframeKey, string> = {
  '30D': 'last 30 days',
  '3M': 'last 3 months',
  '6M': 'last 6 months',
  YTD: 'year to date',
  '1Y': 'last 12 months',
  ALL: 'all time',
};

export const TIMEFRAME_OPTIONS: Array<{ value: TimeframeKey; label: string }> = [
  { value: '30D', label: '30D' },
  { value: '3M', label: '3M' },
  { value: '6M', label: '6M' },
  { value: 'YTD', label: 'YTD' },
  { value: '1Y', label: '1Y' },
  { value: 'ALL', label: 'ALL' },
];

export const GROUP_LABELS: Record<string, string> = {
  DEPOSITORY: 'Cash & Checking',
  INVESTMENT: 'Investments',
  CRYPTO: 'Crypto',
  PROPERTY: 'Property',
  VEHICLE: 'Vehicles',
  OTHER_ASSET: 'Other Assets',
  CREDIT_CARD: 'Credit Cards',
  LOAN: 'Loans & Mortgages',
  OTHER_LIABILITY: 'Other Liabilities',
};

export function formatSubtypeLabel(acc: WebAccount): string {
  const details = acc.subtypeDetails ?? {};
  const rawSubtype =
    typeof details.accountSubtype === 'string'
      ? details.accountSubtype
      : typeof details.loanSubtype === 'string'
        ? details.loanSubtype
        : typeof details.propertyType === 'string'
          ? details.propertyType
          : typeof details.walletType === 'string'
            ? details.walletType
            : acc.accountType;

  return rawSubtype
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

export function isoDaysAgo(baseDate: string, days: number): string {
  const d = new Date(`${baseDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

export function formatGroupDateHeading(isoDate: string): string {
  const d = new Date(`${isoDate.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return isoDate.toUpperCase();
  return d
    .toLocaleDateString('en-US', {
      month: 'long',
      day: '2-digit',
      year: 'numeric',
      timeZone: 'UTC',
    })
    .toUpperCase();
}

export function formatInspectorDate(isoDate: string): string {
  const d = new Date(`${isoDate.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString('en-US', {
    month: 'long',
    day: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function getTimeframeStartDate(
  timeframe: TimeframeKey,
  todayIso: string,
  earliestIso: string
): string {
  switch (timeframe) {
    case '30D':
      return isoDaysAgo(todayIso, 30);
    case '3M':
      return isoDaysAgo(todayIso, 90);
    case '6M':
      return isoDaysAgo(todayIso, 180);
    case 'YTD':
      return `${todayIso.slice(0, 4)}-01-01`;
    case '1Y':
      return isoDaysAgo(todayIso, 365);
    case 'ALL':
      return earliestIso < isoDaysAgo(todayIso, 30) ? earliestIso : isoDaysAgo(todayIso, 30);
  }
}

export function buildAccountHistorySeries(
  account: WebAccount,
  accountEntries: WebEntry[],
  timeframe: TimeframeKey
): Array<{ date: string; value: number; balanceStr: string }> {
  const sortedEntries = [...accountEntries].sort((a, b) => a.date.localeCompare(b.date));
  const latestEntryDate = sortedEntries[sortedEntries.length - 1]?.date.slice(0, 10);
  const todayIso = new Date().toISOString().slice(0, 10);
  const endDate = latestEntryDate && latestEntryDate > todayIso ? latestEntryDate : todayIso;

  if (timeframe === '30D' && account.sparkline.length >= 2) {
    const pts = account.sparkline;
    return pts.map((v, idx) => ({
      date: isoDaysAgo(endDate, pts.length - 1 - idx),
      value: v,
      balanceStr: v.toFixed(4),
    }));
  }

  const earliestEntryDate = sortedEntries[0]?.date.slice(0, 10) ?? isoDaysAgo(endDate, 30);
  const startDate = getTimeframeStartDate(timeframe, endDate, earliestEntryDate);

  // Reconstruct daily snapshot series walking backwards from current account.balance
  // using Sure BalanceService flowsFactor (-1 for LIABILITY, +1 for ASSET)
  const dailyDelta = new Map<string, string>();
  const flowsFactor = account.classification === 'LIABILITY' ? '-1' : '1';
  for (const e of sortedEntries) {
    const d = e.date.slice(0, 10);
    if (e.entryType === 'TRANSACTION') {
      const signedImpact = mulMoney(e.amount, flowsFactor);
      dailyDelta.set(d, addMoney(dailyDelta.get(d) ?? '0', signedImpact));
    }
  }

  const totalDays = Math.max(
    14,
    Math.round(
      (new Date(`${endDate}T00:00:00Z`).getTime() - new Date(`${startDate}T00:00:00Z`).getTime()) /
        86_400_000
    )
  );
  const stepDays = totalDays > 60 ? Math.ceil(totalDays / 45) : 1;

  const dailyBalances = new Map<string, string>();
  let cursor = account.balance;
  for (let offset = 0; offset <= totalDays; offset++) {
    const d = isoDaysAgo(endDate, offset);
    dailyBalances.set(d, cursor);
    const delta = dailyDelta.get(d);
    if (delta) {
      cursor = subMoney(cursor, delta);
    }
  }

  const series: Array<{ date: string; value: number; balanceStr: string }> = [];
  for (let offset = totalDays; offset >= 0; offset -= stepDays) {
    const d = isoDaysAgo(endDate, offset);
    const bal = dailyBalances.get(d) ?? account.balance;
    series.push({
      date: d,
      value: Number(bal),
      balanceStr: bal,
    });
  }

  const lastPoint = series[series.length - 1];
  if (!lastPoint || lastPoint.date !== endDate) {
    series.push({
      date: endDate,
      value: Number(account.balance),
      balanceStr: account.balance,
    });
  }

  return series;
}
