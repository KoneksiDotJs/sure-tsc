import {
  absMoney,
  AccountType,
  addMoney,
  compareMoney,
  subMoney,
} from '@sure/shared';
import type {
  ApiAccountsResponse,
  ApiBudgetResponse,
  ApiEntryItem,
  ApiSyncResponse,
  LedgerContextValue,
  WebAccount,
  WebConflict,
  WebEntry,
  WebReportData,
} from './types.js';

export function buildDefaultSubtypeDetails(
  accountType: AccountType,
  initialBalance: string,
  provided: Record<string, unknown>
): Record<string, unknown> {
  if (Object.keys(provided).length > 0) {
    return provided;
  }
  switch (accountType) {
    case 'DEPOSITORY':
      return { accountSubtype: 'CHECKING', institutionName: 'Manual Bank' };
    case 'CREDIT_CARD':
      return { creditLimit: '15000.0000', aprPercent: '19.9900', dueDay: 20 };
    case 'INVESTMENT':
      return { accountSubtype: 'BROKERAGE', taxAdvantaged: false };
    case 'CRYPTO':
      return { walletType: 'ON_CHAIN', chain: 'ETHEREUM' };
    case 'PROPERTY':
      return {
        address: 'Primary Address',
        propertyType: 'PRIMARY_RESIDENCE',
        purchasePrice: absMoney(initialBalance) || '350000.0000',
        valuationSource: 'MANUAL',
      };
    case 'VEHICLE':
      return { make: 'Toyota', model: 'Camry', year: 2025 };
    case 'LOAN':
      return {
        loanSubtype: 'MORTGAGE',
        principal: absMoney(initialBalance) || '250000.0000',
        interestRatePercent: '6.2500',
        termMonths: 360,
        rateType: 'FIXED',
      };
    case 'OTHER_ASSET':
      return { description: 'Personal Asset', liquid: false };
    case 'OTHER_LIABILITY':
      return { description: 'Personal Liability' };
  }
}

export function mapAccountsResponse(data: ApiAccountsResponse | undefined): WebAccount[] {
  return (data?.accounts ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    accountType: a.accountType,
    classification: a.classification,
    currency: a.currency,
    balance: a.balance,
    color: a.color,
    icon: a.icon,
    subtypeDetails: a.subtypeDetails ?? {},
    sparkline: (a.sparkline ?? []).map((pt) => Number(pt.balance)),
  }));
}

export function mapEntriesResponse(data: ApiEntryItem[] | undefined): WebEntry[] {
  return (data ?? []).map((e) => ({
    id: e.id,
    accountId: e.accountId,
    entryType: e.entryType,
    date: e.date,
    amount: e.amount,
    currency: e.currency,
    name: e.name,
    categoryId: e.categoryId ?? null,
    merchantId: e.merchantId ?? null,
    tagIds: e.tagIds ?? (Array.isArray(e.tags) ? e.tags.map((t) => t.id) : []),
    notes: e.notes ?? '',
    excluded: e.excluded,
    valuationKind: e.valuationKind,
    tradeDetails: e.tradeDetails,
    splits: (e.splits ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      amount: s.amount,
      categoryId: s.categoryId ?? s.transaction?.categoryId ?? null,
    })),
    transferMatchId: e.transferMatchId ?? null,
    importId: e.importId ?? null,
  }));
}

export function mapConflictsResponse(data: ApiSyncResponse | undefined): WebConflict[] {
  return (data?.pendingConflicts ?? []).map((c) => ({
    id: c.id,
    providerName: c.providerName,
    conflictType: c.conflictType,
    date: c.incomingSummary.date,
    name: c.incomingSummary.name,
    amount: c.incomingSummary.amount,
    accountName: c.incomingSummary.accountName,
    resolved: Boolean(c.resolvedAt),
    resolution: c.resolution ?? undefined,
  }));
}

export function buildBudgetAllocationsMap(
  data: ApiBudgetResponse | undefined
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const row of data?.categories ?? []) {
    map[row.category.id] = row.budgetedAmount;
  }
  return map;
}

export function computeLedgerSummary(
  accountsData: ApiAccountsResponse | undefined,
  reportData: WebReportData | undefined,
  entries: WebEntry[]
): LedgerContextValue['summary'] {
  const accSum = accountsData?.summary;
  const repInc = reportData?.incomeStatement;

  let fallbackIncome = '0.0000';
  let fallbackExpenses = '0.0000';
  for (const e of entries) {
    if (e.entryType !== 'TRANSACTION' || e.excluded || e.transferMatchId) continue;
    if (compareMoney(e.amount, '0.0000') > 0) {
      fallbackIncome = addMoney(fallbackIncome, e.amount);
    } else {
      fallbackExpenses = addMoney(fallbackExpenses, absMoney(e.amount));
    }
  }

  const monthlyIncome = repInc?.totalIncome ?? fallbackIncome;
  const monthlyExpenses = repInc?.totalExpenses ?? fallbackExpenses;
  const monthlyNetSavings = repInc?.netSavings ?? subMoney(monthlyIncome, monthlyExpenses);

  return {
    totalAssets: accSum?.totalAssets ?? '0.0000',
    totalLiabilities: accSum?.totalLiabilities ?? '0.0000',
    netWorth: accSum?.netWorth ?? '0.0000',
    monthlyIncome,
    monthlyExpenses,
    monthlyNetSavings,
  };
}
