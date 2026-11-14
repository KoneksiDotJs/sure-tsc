import React, { createContext, useContext, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AccountType,
  AccountClassification,
  EntryType,
  ValuationKind,
  TradeAction,
  RuleCondition,
  RuleAction,
  ImportFormat,
  RecurringCadence,
  addMoney,
  subMoney,
  absMoney,
  compareMoney,
} from '@sure/shared';
import { apiRequest } from './api-client.js';
import { inferCategoryIconName } from '@sure/ui';
import {
  accountKeys,
  transactionKeys,
  budgetKeys,
  goalKeys,
  ruleKeys,
  reportKeys,
  syncKeys,
} from './query-keys.js';
import { useAuth } from '../features/auth/AuthContext.js';

export interface WebAccount {
  id: string;
  name: string;
  accountType: AccountType;
  classification: AccountClassification;
  currency: string;
  balance: string;
  color: string;
  icon: string;
  subtypeDetails: Record<string, unknown>;
  sparkline: number[];
}

export interface WebCategory {
  id: string;
  name: string;
  classification: 'INCOME' | 'EXPENSE' | 'TRANSFER';
  color: string;
  icon: string;
}

export interface WebMerchant {
  id: string;
  name: string;
  color: string;
}

export interface WebTag {
  id: string;
  name: string;
  color: string;
}

export interface WebSplitItem {
  id: string;
  name: string;
  amount: string;
  categoryId: string | null;
}

export interface WebEntry {
  id: string;
  accountId: string;
  entryType: EntryType;
  date: string;
  amount: string;
  currency: string;
  name: string;
  categoryId: string | null;
  merchantId: string | null;
  tagIds: string[];
  notes: string;
  excluded: boolean;
  valuationKind?: ValuationKind;
  tradeDetails?: {
    securityTicker: string;
    securityName: string;
    tradeAction: TradeAction;
    qty: string;
    price: string;
    fees: string;
  };
  splits: WebSplitItem[];
  transferMatchId: string | null;
  importId: string | null;
}

export interface WebRule {
  id: string;
  name: string;
  groupName: string;
  priority: number;
  matchMode: 'ALL' | 'ANY';
  isActive: boolean;
  conditions: RuleCondition[];
  actions: RuleAction;
}

export interface WebImportBatch {
  id: string;
  accountId: string;
  format: ImportFormat;
  fileName: string;
  rowCount: number;
  status: 'STAGED' | 'COMPLETED' | 'REVERTED';
  createdAt: string;
}

export interface WebGoal {
  id: string;
  name: string;
  targetAmount: string;
  currentAmount: string;
  monthlyPledge: string;
  targetDate: string;
  color: string;
  linkedAccountIds: string[];
  status?: 'REACHED' | 'ON_TRACK' | 'BEHIND';
  requiredMonthlyAmount?: string;
  linkedAccounts?: Array<{
    id: string;
    name: string;
    balance: string;
    currency: string;
    color: string;
  }>;
}

export interface WebRecurring {
  id: string;
  name: string;
  amount: string;
  lastAmount: string | null;
  currency: string;
  cadence: RecurringCadence;
  nextOccurrenceDate: string;
  accountId: string;
  categoryId: string | null;
  autoPay: boolean;
}

export interface WebConflict {
  id: string;
  providerName: string;
  conflictType: 'DUPLICATE_ENTRY' | 'UNMAPPED_ACCOUNT' | 'BALANCE_MISMATCH';
  date: string;
  name: string;
  amount: string;
  accountName: string;
  resolved: boolean;
  resolution?: string;
}

export interface WebInsight {
  id: string;
  type: 'SPENDING_ANOMALY' | 'SUBSCRIPTION_HIKE' | 'IDLE_CASH' | 'NET_WORTH_MILESTONE';
  severity: 'INFO' | 'WARNING' | 'POSITIVE';
  title: string;
  description: string;
  metricAmount: string;
}

interface ApiAccountsResponse {
  accounts: Array<{
    id: string;
    name: string;
    accountType: AccountType;
    classification: AccountClassification;
    currency: string;
    balance: string;
    color: string;
    icon: string;
    subtypeDetails: Record<string, unknown>;
    sparkline?: Array<{ date: string; balance: string }>;
  }>;
  summary: {
    baseCurrency: string;
    totalAssets: string;
    totalLiabilities: string;
    netWorth: string;
  };
}

interface ApiEntryItem {
  id: string;
  accountId: string;
  entryType: EntryType;
  date: string;
  amount: string;
  currency: string;
  name: string;
  categoryId?: string | null;
  merchantId?: string | null;
  tagIds?: string[];
  tags?: Array<{ id: string }>;
  notes?: string | null;
  excluded: boolean;
  valuationKind?: ValuationKind;
  tradeDetails?: WebEntry['tradeDetails'];
  splits?: Array<{
    id: string;
    name: string;
    amount: string;
    categoryId?: string | null;
    transaction?: { categoryId?: string | null } | null;
  }>;
  transferMatchId?: string | null;
  importId?: string | null;
}

interface ApiTaxonomiesResponse {
  categories: WebCategory[];
  merchants: WebMerchant[];
  tags: WebTag[];
}

interface ApiBudgetResponse {
  month: string;
  expectedIncome: string;
  rolloverEnabled: boolean;
  totalBudgeted: string;
  totalSpent: string;
  totalRemaining: string;
  categories: Array<{
    category: WebCategory;
    budgetedAmount: string;
    actualSpent: string;
    previousRolloverBalance: string;
    rolloverEnabled: boolean;
    effectiveAvailable: string;
    remainingBalance: string;
    utilizationPercent: string;
    isOverBudget: boolean;
  }>;
}

export interface WebReportData {
  baseCurrency: string;
  balanceSheet: {
    totalAssets: string;
    totalLiabilities: string;
    netWorth: string;
    assetMix: {
      cashAndDepository: string;
      investmentsAndCrypto: string;
      realEstateAndVehicles: string;
      otherAssets: string;
    };
    netWorthHistory: Array<{
      date: string;
      assets: string;
      liabilities: string;
      netWorth: string;
    }>;
  };
  incomeStatement: {
    totalIncome: string;
    totalExpenses: string;
    netSavings: string;
    savingsRatePercent: string;
    incomeBreakdown: Array<{ name: string; color: string; amount: string }>;
    expenseBreakdown: Array<{ name: string; color: string; amount: string }>;
  };
  spendingVsNormal?: {
    currentMonth: string;
    priorMonthsCompared: number;
    categories: Array<{
      name: string;
      color: string;
      currentSpent: string;
      normalAverage: string;
      deltaAmount: string;
      deltaPercent: string;
      status: 'ABOVE' | 'BELOW' | 'ON_PACE';
      priorMonthsCount: number;
    }>;
  };
  sankey: {
    nodes: Array<{ id: string; label: string; color: string; amount: string }>;
    links: Array<{ source: string; target: string; value: string; color: string }>;
  };
}

export interface WebProviderAdapter {
  key: string;
  name: string;
  category: 'BANKING' | 'CRYPTO' | 'BROKERAGE' | 'MARKET_DATA';
  regions: string[];
  supportsWebhooks: boolean;
}

export interface WebProviderConnection {
  id: string;
  providerName: string;
  institutionName: string;
  status: string;
  lastSyncedAt: string | null;
  createdAt: string;
}

export interface WebAccountHolding {
  id: string;
  accountId: string;
  ticker: string;
  securityName: string;
  assetClass: string;
  currency: string;
  qty: string;
  avgCostBasis: string;
  currentPrice: string;
  marketValue: string;
  costBasisTotal: string;
  unrealizedGain: string;
  returnPercent: string;
  portfolioWeightPercent: string;
}

export interface WebHoldingsSummary {
  accountId: string;
  totalMarketValue: string;
  totalCostBasis: string;
  totalGain: string;
  totalReturnPercent: string;
  holdings: WebAccountHolding[];
}

export interface WebTransferSuggestion {
  outflowEntryId: string;
  inflowEntryId: string;
  amount: string;
  outflowName: string;
  outflowAccountName: string;
  outflowDate: string;
  inflowName: string;
  inflowAccountName: string;
  inflowDate: string;
}

interface ApiSyncResponse {
  adapters: WebProviderAdapter[];
  connections: WebProviderConnection[];
  pendingConflicts: Array<{
    id: string;
    providerName: string;
    conflictType: 'DUPLICATE_ENTRY' | 'UNMAPPED_ACCOUNT' | 'BALANCE_MISMATCH';
    incomingSummary: {
      date: string;
      name: string;
      amount: string;
      accountName: string;
    };
    resolution: string | null;
    resolvedAt: string | null;
  }>;
}

function buildDefaultSubtypeDetails(
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

interface LedgerContextValue {
  isLoading: boolean;
  lastError: string | null;
  clearError: () => void;
  family: {
    id: string;
    name: string;
    baseCurrency: string;
    aiEnabled: boolean;
    locale: string;
    dateFormat: string;
    mfaEnabled: boolean;
    members: Array<{ id: string; name: string; email: string; role: 'OWNER' | 'ADMIN' | 'MEMBER' }>;
    apiKeys: Array<{ id: string; name: string; prefix: string; scopes: string[]; createdAt: string }>;
  };
  updateFamilySettings: (
    patch: Partial<{
      name: string;
      baseCurrency: string;
      aiEnabled: boolean;
      locale: string;
      dateFormat: string;
      mfaEnabled: boolean;
    }>
  ) => Promise<void>;
  inviteFamilyMember: (input: {
    email: string;
    name: string;
    role: 'ADMIN' | 'MEMBER';
  }) => Promise<void>;
  setupMfa: () => Promise<{ secret: string; otpauthUri: string }>;
  enableMfa: (totpCode: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  downloadFamilyBackup: () => Promise<void>;
  createApiKey: (name: string, scopes: string[]) => Promise<string>;
  deleteApiKey: (id: string) => Promise<void>;
  accounts: WebAccount[];
  categories: WebCategory[];
  merchants: WebMerchant[];
  tags: WebTag[];
  entries: WebEntry[];
  rules: WebRule[];
  imports: WebImportBatch[];
  goals: WebGoal[];
  recurring: WebRecurring[];
  conflicts: WebConflict[];
  syncAdapters: WebProviderAdapter[];
  syncConnections: WebProviderConnection[];
  insights: WebInsight[];
  reportData: WebReportData | null;
  budgetMonth: string;
  setBudgetMonth: (month: string) => void;
  budgetRows: ApiBudgetResponse['categories'];
  budgetRolloverEnabled: boolean;
  setBudgetRolloverEnabled: (v: boolean) => Promise<void>;
  budgetAllocations: Record<string, string>;
  updateBudgetAllocation: (categoryId: string, amount: string) => Promise<void>;
  summary: {
    totalAssets: string;
    totalLiabilities: string;
    netWorth: string;
    monthlyIncome: string;
    monthlyExpenses: string;
    monthlyNetSavings: string;
  };
  createAccount: (input: {
    name: string;
    accountType: AccountType;
    currency: string;
    initialBalance: string;
    color: string;
    icon: string;
    subtypeDetails: Record<string, unknown>;
  }) => Promise<void>;
  deleteAccount: (accountId: string) => Promise<void>;
  fetchAccountHoldings: (accountId: string) => Promise<WebHoldingsSummary>;
  upsertAccountHolding: (
    accountId: string,
    input: {
      ticker: string;
      securityName: string;
      assetClass: string;
      qty: string;
      avgCostBasis: string;
      currentPrice: string;
    }
  ) => Promise<WebHoldingsSummary>;
  createEntry: (
    input: Omit<WebEntry, 'id' | 'splits' | 'transferMatchId' | 'importId'>
  ) => Promise<void>;
  updateEntry: (id: string, patch: Partial<WebEntry>) => Promise<void>;
  deleteEntries: (ids: string[]) => Promise<void>;
  splitEntry: (entryId: string, splits: WebSplitItem[]) => Promise<void>;
  createTransfer: (input: {
    fromAccountId: string;
    toAccountId: string;
    date: string;
    amount: string;
    name?: string;
    notes?: string | null;
  }) => Promise<void>;
  matchTransfer: (outflowId: string, inflowId: string) => Promise<void>;
  fetchTransferSuggestions: () => Promise<WebTransferSuggestion[]>;
  bulkCategorizeEntries: (ids: string[], categoryId: string | null) => Promise<void>;
  bulkToggleExcludeEntries: (ids: string[]) => Promise<void>;
  createCategory: (
    name: string,
    classification?: 'INCOME' | 'EXPENSE',
    icon?: string,
    color?: string
  ) => Promise<WebCategory>;
  createMerchant: (name: string) => Promise<WebMerchant>;
  createTag: (name: string) => Promise<WebTag>;
  previewImportFile: (params: {
    accountId: string;
    format: ImportFormat;
    fileName: string;
    rawContent: string;
    columnMapping?: {
      dateColumn: string;
      nameColumn: string;
      amountColumn: string;
      invertSign?: boolean;
    };
  }) => Promise<{
    importBatch: WebImportBatch;
    previewRows: Array<{
      date: string;
      name: string;
      amount: string;
      duplicateWarning: boolean;
    }>;
  }>;
  commitStagedImport: (params: {
    importId: string;
    rows: Array<{ date: string; name: string; amount: string; skip?: boolean }>;
  }) => Promise<void>;
  commitImportBatch: (params: {
    accountId: string;
    format: ImportFormat;
    fileName: string;
    rows: Array<{ date: string; name: string; amount: string; categoryId?: string | null }>;
  }) => Promise<void>;
  revertImportBatch: (importId: string) => Promise<void>;
  createRule: (rule: Omit<WebRule, 'id'>) => Promise<void>;
  toggleRuleActive: (ruleId: string, isActive: boolean) => Promise<void>;
  deleteRule: (ruleId: string) => Promise<void>;
  dryRunRule: (params: {
    matchMode: 'ALL' | 'ANY';
    conditions: RuleCondition[];
    actions: RuleAction;
  }) => Promise<{
    totalEvaluated: number;
    matchCount: number;
    matches: Array<{
      id: string;
      date: string;
      name: string;
      amount: string;
      proposedName: string;
    }>;
  }>;
  applyAllRules: () => Promise<number>;
  createGoal: (goal: Omit<WebGoal, 'id'>) => Promise<void>;
  deleteGoal: (goalId: string) => Promise<void>;
  createRecurringBill: (input: {
    name: string;
    amount: string;
    currency: string;
    cadence: RecurringCadence;
    nextOccurrenceDate: string;
    accountId: string;
    categoryId?: string | null;
    autoPay?: boolean;
  }) => Promise<void>;
  markRecurringPaid: (recurringId: string, paidDate?: string) => Promise<void>;
  deleteRecurringBill: (recurringId: string) => Promise<void>;
  connectProvider: (input: {
    providerKey: string;
    institutionName: string;
  }) => Promise<void>;
  runSyncAll: () => Promise<{ syncedConnections: number; materializedAccounts: number }>;
  resolveConflict: (conflictId: string, resolution: string) => Promise<void>;
  runBayesAutoCategorizer: () => Promise<number>;
}

const LedgerContext = createContext<LedgerContextValue | null>(null);

export const LedgerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session, refreshSession } = useAuth();
  const queryClient = useQueryClient();
  const [lastError, setLastError] = useState<string | null>(null);
  const enabled = Boolean(session);
  const [budgetMonth, setBudgetMonth] = useState(() => new Date().toISOString().slice(0, 7));

  const accountsQuery = useQuery({
    queryKey: accountKeys.lists(),
    queryFn: () => apiRequest<ApiAccountsResponse>('/api/v1/accounts'),
    enabled,
  });

  const taxonomiesQuery = useQuery({
    queryKey: ['taxonomies'] as const,
    queryFn: () => apiRequest<ApiTaxonomiesResponse>('/api/v1/taxonomies'),
    enabled,
  });

  const entriesQuery = useQuery({
    queryKey: transactionKeys.list({}),
    queryFn: () => apiRequest<ApiEntryItem[]>('/api/v1/entries?perPage=100'),
    enabled,
  });

  const rulesQuery = useQuery({
    queryKey: ruleKeys.all,
    queryFn: () => apiRequest<WebRule[]>('/api/v1/rules'),
    enabled,
  });

  const importsQuery = useQuery({
    queryKey: ['imports'] as const,
    queryFn: () => apiRequest<WebImportBatch[]>('/api/v1/imports'),
    enabled,
  });

  const budgetsQuery = useQuery({
    queryKey: budgetKeys.month(budgetMonth),
    queryFn: () => apiRequest<ApiBudgetResponse>(`/api/v1/budgets/${budgetMonth}`),
    enabled,
  });

  const goalsQuery = useQuery({
    queryKey: goalKeys.all,
    queryFn: () => apiRequest<WebGoal[]>('/api/v1/goals'),
    enabled,
  });

  const recurringQuery = useQuery({
    queryKey: ['recurring'] as const,
    queryFn: () => apiRequest<WebRecurring[]>('/api/v1/recurring'),
    enabled,
  });

  const reportsQuery = useQuery({
    queryKey: reportKeys.all,
    queryFn: () => apiRequest<WebReportData>('/api/v1/reports'),
    enabled,
  });

  const syncQuery = useQuery({
    queryKey: syncKeys.all,
    queryFn: () => apiRequest<ApiSyncResponse>('/api/v1/sync'),
    enabled,
  });

  const insightsQuery = useQuery({
    queryKey: ['ai', 'insights'] as const,
    queryFn: () => apiRequest<WebInsight[]>('/api/v1/ai/insights'),
    enabled,
  });

  const invalidateLedger = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: accountKeys.all }),
      queryClient.invalidateQueries({ queryKey: transactionKeys.lists() }),
      queryClient.invalidateQueries({ queryKey: reportKeys.all }),
      queryClient.invalidateQueries({ queryKey: budgetKeys.all }),
      queryClient.invalidateQueries({ queryKey: ['ai', 'insights'] }),
    ]);
  };

  const accounts: WebAccount[] = useMemo(
    () =>
      (accountsQuery.data?.accounts ?? []).map((a) => ({
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
      })),
    [accountsQuery.data]
  );

  const categories = taxonomiesQuery.data?.categories ?? [];
  const merchants = taxonomiesQuery.data?.merchants ?? [];
  const tags = taxonomiesQuery.data?.tags ?? [];

  const entries: WebEntry[] = useMemo(
    () =>
      (entriesQuery.data ?? []).map((e) => ({
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
      })),
    [entriesQuery.data]
  );

  const rules = rulesQuery.data ?? [];
  const imports = importsQuery.data ?? [];
  const goals = goalsQuery.data ?? [];
  const recurring = recurringQuery.data ?? [];
  const insights = insightsQuery.data ?? [];

  const conflicts: WebConflict[] = useMemo(
    () =>
      (syncQuery.data?.pendingConflicts ?? []).map((c) => ({
        id: c.id,
        providerName: c.providerName,
        conflictType: c.conflictType,
        date: c.incomingSummary.date,
        name: c.incomingSummary.name,
        amount: c.incomingSummary.amount,
        accountName: c.incomingSummary.accountName,
        resolved: Boolean(c.resolvedAt),
        resolution: c.resolution ?? undefined,
      })),
    [syncQuery.data]
  );

  const budgetRolloverEnabled = budgetsQuery.data?.rolloverEnabled ?? true;
  const budgetAllocations = useMemo(() => {
    const map: Record<string, string> = {};
    for (const row of budgetsQuery.data?.categories ?? []) {
      map[row.category.id] = row.budgetedAmount;
    }
    return map;
  }, [budgetsQuery.data]);

  const summary = useMemo(() => {
    const accSum = accountsQuery.data?.summary;
    const repInc = reportsQuery.data?.incomeStatement;

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
    const monthlyNetSavings =
      repInc?.netSavings ?? subMoney(monthlyIncome, monthlyExpenses);

    return {
      totalAssets: accSum?.totalAssets ?? '0.0000',
      totalLiabilities: accSum?.totalLiabilities ?? '0.0000',
      netWorth: accSum?.netWorth ?? '0.0000',
      monthlyIncome,
      monthlyExpenses,
      monthlyNetSavings,
    };
  }, [accountsQuery.data, reportsQuery.data, entries]);

  const family = useMemo(
    () => ({
      id: session?.family.id ?? '',
      name: session?.family.name ?? 'Family Workspace',
      baseCurrency: session?.family.baseCurrency ?? 'USD',
      aiEnabled: session?.family.aiEnabled ?? false,
      locale: session?.family.locale ?? 'en-US',
      dateFormat: session?.family.dateFormat ?? 'YYYY-MM-DD',
      mfaEnabled: session?.user.mfaEnabled ?? false,
      members: (session?.memberships ?? []).map((m) => ({
        id: m.id,
        name: m.name,
        email: m.email,
        role: m.role,
      })),
      apiKeys: (session?.apiKeys ?? []).map((k) => ({
        id: k.id,
        name: k.name,
        prefix: k.keyPrefix,
        scopes: k.scopes,
        createdAt: k.createdAt.slice(0, 10),
      })),
    }),
    [session]
  );

  const runAction = async <T,>(fn: () => Promise<T>): Promise<T> => {
    try {
      setLastError(null);
      return await fn();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Request failed';
      setLastError(msg);
      throw err;
    }
  };

  const updateFamilySettings: LedgerContextValue['updateFamilySettings'] = (patch) =>
    runAction(async () => {
      if (typeof patch.mfaEnabled === 'boolean' && !patch.mfaEnabled) {
        await apiRequest('/api/v1/auth/mfa/disable', { method: 'POST' });
      }
      if (
        patch.name !== undefined ||
        patch.baseCurrency !== undefined ||
        patch.aiEnabled !== undefined ||
        patch.locale !== undefined ||
        patch.dateFormat !== undefined
      ) {
        await apiRequest('/api/v1/family', {
          method: 'PATCH',
          body: JSON.stringify({
            ...(patch.name !== undefined ? { name: patch.name } : {}),
            ...(patch.baseCurrency !== undefined ? { baseCurrency: patch.baseCurrency } : {}),
            ...(patch.aiEnabled !== undefined ? { aiEnabled: patch.aiEnabled } : {}),
            ...(patch.locale !== undefined ? { locale: patch.locale } : {}),
            ...(patch.dateFormat !== undefined ? { dateFormat: patch.dateFormat } : {}),
          }),
        });
      }
      await refreshSession();
      await queryClient.invalidateQueries({ queryKey: reportKeys.all });
    });

  const inviteFamilyMember: LedgerContextValue['inviteFamilyMember'] = (input) =>
    runAction(async () => {
      await apiRequest('/api/v1/family/members', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      await refreshSession();
    });

  const setupMfa = () =>
    runAction(() =>
      apiRequest<{ secret: string; otpauthUri: string }>('/api/v1/auth/mfa/setup', {
        method: 'POST',
      })
    );

  const enableMfa = (totpCode: string) =>
    runAction(async () => {
      await apiRequest('/api/v1/auth/mfa/enable', {
        method: 'POST',
        body: JSON.stringify({ totpCode }),
      });
      await refreshSession();
    });

  const changePassword = (currentPassword: string, newPassword: string) =>
    runAction(async () => {
      await apiRequest('/api/v1/auth/password', {
        method: 'PATCH',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
    });

  const downloadFamilyBackup = () =>
    runAction(async () => {
      const snapshot = await apiRequest<Record<string, unknown>>('/api/v1/family/backup');
      const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sure-family-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    });

  const createApiKey = (name: string, scopes: string[]) =>
    runAction(async () => {
      const created = await apiRequest<{ secret: string }>('/api/v1/auth/api-keys', {
        method: 'POST',
        body: JSON.stringify({ name, scopes }),
      });
      await refreshSession();
      return created.secret;
    });

  const deleteApiKey = (id: string) =>
    runAction(async () => {
      await apiRequest(`/api/v1/auth/api-keys/${id}`, { method: 'DELETE' });
      await refreshSession();
    });

  const persistBudget = async (nextRollover: boolean, nextAllocations: Record<string, string>) => {
    await apiRequest('/api/v1/budgets', {
      method: 'PUT',
      body: JSON.stringify({
        month: budgetMonth,
        expectedIncome: budgetsQuery.data?.expectedIncome ?? '12500.0000',
        rolloverEnabled: nextRollover,
        allocations: Object.entries(nextAllocations).map(([categoryId, budgetedAmount]) => ({
          categoryId,
          budgetedAmount,
          rolloverEnabled: nextRollover,
        })),
      }),
    });
    await queryClient.invalidateQueries({ queryKey: budgetKeys.all });
  };

  const setBudgetRolloverEnabled = (v: boolean) =>
    runAction(() => persistBudget(v, budgetAllocations));

  const updateBudgetAllocation = (categoryId: string, amount: string) =>
    runAction(() =>
      persistBudget(budgetRolloverEnabled, {
        ...budgetAllocations,
        [categoryId]: amount,
      })
    );

  const createAccount: LedgerContextValue['createAccount'] = (input) =>
    runAction(async () => {
      await apiRequest('/api/v1/accounts', {
        method: 'POST',
        body: JSON.stringify({
          name: input.name,
          accountType: input.accountType,
          currency: input.currency,
          initialBalance: input.initialBalance,
          color: input.color,
          icon: input.icon,
          subtypeDetails: buildDefaultSubtypeDetails(
            input.accountType,
            input.initialBalance,
            input.subtypeDetails
          ),
        }),
      });
      await invalidateLedger();
    });

  const deleteAccount = (accountId: string) =>
    runAction(async () => {
      await apiRequest(`/api/v1/accounts/${accountId}`, { method: 'DELETE' });
      await invalidateLedger();
    });

  const fetchAccountHoldings = (accountId: string) =>
    runAction(() =>
      apiRequest<WebHoldingsSummary>(`/api/v1/accounts/${accountId}/holdings`)
    );

  const upsertAccountHolding: LedgerContextValue['upsertAccountHolding'] = (accountId, input) =>
    runAction(async () => {
      const res = await apiRequest<WebHoldingsSummary>(
        `/api/v1/accounts/${accountId}/holdings`,
        {
          method: 'POST',
          body: JSON.stringify(input),
        }
      );
      await invalidateLedger();
      return res;
    });

  const createEntry: LedgerContextValue['createEntry'] = (input) =>
    runAction(async () => {
      const payload =
        input.entryType === 'VALUATION'
          ? {
              entryType: 'VALUATION',
              accountId: input.accountId,
              date: input.date,
              amount: input.amount,
              currency: input.currency,
              name: input.name,
              valuationKind: input.valuationKind ?? 'RECONCILIATION',
              notes: input.notes ?? null,
            }
          : input.entryType === 'TRADE'
          ? {
              entryType: 'TRADE',
              accountId: input.accountId,
              date: input.date,
              amount: input.amount,
              currency: input.currency,
              name: input.name,
              securityTicker: input.tradeDetails?.securityTicker ?? 'VTI',
              securityName: input.tradeDetails?.securityName ?? input.name,
              tradeAction: input.tradeDetails?.tradeAction ?? 'BUY',
              qty: input.tradeDetails?.qty ?? '1.0000',
              price: input.tradeDetails?.price ?? absMoney(input.amount),
              fees: input.tradeDetails?.fees ?? '0.0000',
              notes: input.notes ?? null,
            }
          : {
              entryType: 'TRANSACTION',
              accountId: input.accountId,
              date: input.date,
              amount: input.amount,
              currency: input.currency,
              name: input.name,
              categoryId: input.categoryId,
              merchantId: input.merchantId,
              tagIds: input.tagIds,
              notes: input.notes ?? null,
              excluded: input.excluded,
              attachments: [],
            };

      await apiRequest('/api/v1/entries', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      await invalidateLedger();
    });

  const updateEntry: LedgerContextValue['updateEntry'] = (id, patch) =>
    runAction(async () => {
      await apiRequest(`/api/v1/entries/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          ...(patch.date !== undefined ? { date: patch.date } : {}),
          ...(patch.amount !== undefined ? { amount: patch.amount } : {}),
          ...(patch.name !== undefined ? { name: patch.name } : {}),
          ...(patch.categoryId !== undefined ? { categoryId: patch.categoryId } : {}),
          ...(patch.merchantId !== undefined ? { merchantId: patch.merchantId } : {}),
          ...(patch.tagIds !== undefined ? { tagIds: patch.tagIds } : {}),
          ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
          ...(patch.excluded !== undefined ? { excluded: patch.excluded } : {}),
        }),
      });
      await invalidateLedger();
    });

  const deleteEntries = (ids: string[]) =>
    runAction(async () => {
      if (ids.length === 0) return;
      await apiRequest('/api/v1/entries/bulk', {
        method: 'POST',
        body: JSON.stringify({ entryIds: ids, action: 'DELETE' }),
      });
      await invalidateLedger();
    });

  const splitEntry = (entryId: string, splits: WebSplitItem[]) =>
    runAction(async () => {
      await apiRequest(`/api/v1/entries/${entryId}/split`, {
        method: 'POST',
        body: JSON.stringify({
          splits: splits.map((s) => ({
            name: s.name,
            amount: s.amount,
            categoryId: s.categoryId,
          })),
        }),
      });
      await invalidateLedger();
    });

  const createTransfer = (input: {
    fromAccountId: string;
    toAccountId: string;
    date: string;
    amount: string;
    name?: string;
    notes?: string | null;
  }) =>
    runAction(async () => {
      await apiRequest('/api/v1/entries/transfers', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      await invalidateLedger();
    });

  const matchTransfer = (outflowId: string, inflowId: string) =>
    runAction(async () => {
      await apiRequest('/api/v1/entries/transfers/match', {
        method: 'POST',
        body: JSON.stringify({ outflowEntryId: outflowId, inflowEntryId: inflowId }),
      });
      await invalidateLedger();
    });

  const fetchTransferSuggestions = () =>
    runAction(() => apiRequest<WebTransferSuggestion[]>('/api/v1/entries/transfers/suggestions'));

  const bulkCategorizeEntries = (ids: string[], categoryId: string | null) =>
    runAction(async () => {
      if (ids.length === 0) return;
      await apiRequest('/api/v1/entries/bulk', {
        method: 'POST',
        body: JSON.stringify({ entryIds: ids, action: 'CATEGORIZE', categoryId }),
      });
      await invalidateLedger();
    });

  const bulkToggleExcludeEntries = (ids: string[]) =>
    runAction(async () => {
      if (ids.length === 0) return;
      await apiRequest('/api/v1/entries/bulk', {
        method: 'POST',
        body: JSON.stringify({ entryIds: ids, action: 'TOGGLE_EXCLUDED' }),
      });
      await invalidateLedger();
    });

  const createCategory = (
    name: string,
    classification: 'INCOME' | 'EXPENSE' = 'EXPENSE',
    icon?: string,
    color?: string
  ) =>
    runAction(async () => {
      const resolvedIcon = inferCategoryIconName(icon, name);
      const resolvedColor = color ?? (classification === 'INCOME' ? '#10b981' : '#3b82f6');
      const created = await apiRequest<WebCategory>('/api/v1/taxonomies/categories', {
        method: 'POST',
        body: JSON.stringify({ name, classification, color: resolvedColor, icon: resolvedIcon }),
      });
      await queryClient.invalidateQueries({ queryKey: ['taxonomies'] });
      return created;
    });

  const createMerchant = (name: string) =>
    runAction(async () => {
      const created = await apiRequest<WebMerchant>('/api/v1/taxonomies/merchants', {
        method: 'POST',
        body: JSON.stringify({ name, color: '#6366f1', icon: 'Store' }),
      });
      await queryClient.invalidateQueries({ queryKey: ['taxonomies'] });
      return created;
    });

  const createTag = (name: string) =>
    runAction(async () => {
      const created = await apiRequest<WebTag>('/api/v1/taxonomies/tags', {
        method: 'POST',
        body: JSON.stringify({ name, color: '#10b981' }),
      });
      await queryClient.invalidateQueries({ queryKey: ['taxonomies'] });
      return created;
    });

  const previewImportFile: LedgerContextValue['previewImportFile'] = (params) =>
    runAction(() =>
      apiRequest<{
        importBatch: WebImportBatch;
        previewRows: Array<{
          date: string;
          name: string;
          amount: string;
          duplicateWarning: boolean;
        }>;
      }>('/api/v1/imports/preview', {
        method: 'POST',
        body: JSON.stringify(params),
      })
    );

  const commitStagedImport: LedgerContextValue['commitStagedImport'] = ({ importId, rows }) =>
    runAction(async () => {
      await apiRequest('/api/v1/imports/commit', {
        method: 'POST',
        body: JSON.stringify({
          importId,
          rows: rows.map((r) => ({
            date: r.date,
            name: r.name,
            amount: r.amount,
            skip: Boolean(r.skip),
          })),
        }),
      });
      await queryClient.invalidateQueries({ queryKey: ['imports'] });
      await invalidateLedger();
    });

  const commitImportBatch: LedgerContextValue['commitImportBatch'] = ({
    accountId,
    format,
    fileName,
    rows,
  }) =>
    runAction(async () => {
      const rawContent = [
        'date,name,amount',
        ...rows.map((r) => `${r.date},${r.name.replace(/,/g, ' ')},${r.amount}`),
      ].join('\n');

      const preview = await apiRequest<{ importBatch: { id: string } }>(
        '/api/v1/imports/preview',
        {
          method: 'POST',
          body: JSON.stringify({
            accountId,
            format,
            fileName,
            rawContent,
          }),
        }
      );

      const catById = new Map(categories.map((c) => [c.id, c.name]));
      await apiRequest('/api/v1/imports/commit', {
        method: 'POST',
        body: JSON.stringify({
          importId: preview.importBatch.id,
          rows: rows.map((r) => ({
            date: r.date,
            name: r.name,
            amount: r.amount,
            ...(r.categoryId && catById.has(r.categoryId)
              ? { categoryName: catById.get(r.categoryId) }
              : {}),
            skip: false,
          })),
        }),
      });

      await queryClient.invalidateQueries({ queryKey: ['imports'] });
      await invalidateLedger();
    });

  const revertImportBatch = (importId: string) =>
    runAction(async () => {
      await apiRequest(`/api/v1/imports/${importId}/revert`, { method: 'POST' });
      await queryClient.invalidateQueries({ queryKey: ['imports'] });
      await invalidateLedger();
    });

  const createRule: LedgerContextValue['createRule'] = (rule) =>
    runAction(async () => {
      await apiRequest('/api/v1/rules', {
        method: 'POST',
        body: JSON.stringify(rule),
      });
      await queryClient.invalidateQueries({ queryKey: ruleKeys.all });
    });

  const deleteRule = (ruleId: string) =>
    runAction(async () => {
      await apiRequest(`/api/v1/rules/${ruleId}`, { method: 'DELETE' });
      await queryClient.invalidateQueries({ queryKey: ruleKeys.all });
    });

  const toggleRuleActive = (ruleId: string, isActive: boolean) =>
    runAction(async () => {
      await apiRequest(`/api/v1/rules/${ruleId}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive }),
      });
      await queryClient.invalidateQueries({ queryKey: ruleKeys.all });
    });

  const dryRunRule: LedgerContextValue['dryRunRule'] = (params) =>
    runAction(() =>
      apiRequest<{
        totalEvaluated: number;
        matchCount: number;
        matches: Array<{
          id: string;
          date: string;
          name: string;
          amount: string;
          proposedName: string;
        }>;
      }>('/api/v1/rules/dry-run', {
        method: 'POST',
        body: JSON.stringify(params),
      })
    );

  const applyAllRules = () =>
    runAction(async () => {
      const res = await apiRequest<{ updatedCount?: number; affectedCount?: number }>(
        '/api/v1/rules/execute',
        { method: 'POST' }
      );
      await invalidateLedger();
      return res.updatedCount ?? res.affectedCount ?? 0;
    });

  const createGoal: LedgerContextValue['createGoal'] = (goal) =>
    runAction(async () => {
      await apiRequest('/api/v1/goals', {
        method: 'POST',
        body: JSON.stringify({
          name: goal.name,
          targetAmount: goal.targetAmount,
          currentAmount: goal.currentAmount,
          monthlyPledge: goal.monthlyPledge,
          targetDate: goal.targetDate,
          color: goal.color,
          icon: 'Target',
          linkedAccountIds: goal.linkedAccountIds,
        }),
      });
      await queryClient.invalidateQueries({ queryKey: goalKeys.all });
    });

  const deleteGoal = (goalId: string) =>
    runAction(async () => {
      await apiRequest(`/api/v1/goals/${goalId}`, { method: 'DELETE' });
      await queryClient.invalidateQueries({ queryKey: goalKeys.all });
    });

  const createRecurringBill: LedgerContextValue['createRecurringBill'] = (input) =>
    runAction(async () => {
      await apiRequest('/api/v1/recurring', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      await queryClient.invalidateQueries({ queryKey: ['recurring'] });
    });

  const markRecurringPaid = (recurringId: string, paidDate?: string) =>
    runAction(async () => {
      await apiRequest(`/api/v1/recurring/${recurringId}/mark-paid`, {
        method: 'POST',
        body: JSON.stringify({ ...(paidDate ? { paidDate } : {}) }),
      });
      await queryClient.invalidateQueries({ queryKey: ['recurring'] });
      await invalidateLedger();
    });

  const deleteRecurringBill = (recurringId: string) =>
    runAction(async () => {
      await apiRequest(`/api/v1/recurring/${recurringId}`, { method: 'DELETE' });
      await queryClient.invalidateQueries({ queryKey: ['recurring'] });
    });

  const connectProvider: LedgerContextValue['connectProvider'] = (input) =>
    runAction(async () => {
      await apiRequest('/api/v1/sync/connections', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      await queryClient.invalidateQueries({ queryKey: syncKeys.all });
    });

  const runSyncAll = () =>
    runAction(async () => {
      const res = await apiRequest<{ syncedConnections: number; materializedAccounts: number }>(
        '/api/v1/sync/run',
        { method: 'POST' }
      );
      await queryClient.invalidateQueries({ queryKey: syncKeys.all });
      await invalidateLedger();
      return res;
    });

  const resolveConflict = (conflictId: string, resolution: string) =>
    runAction(async () => {
      await apiRequest('/api/v1/sync/conflicts/resolve', {
        method: 'POST',
        body: JSON.stringify({ conflictId, resolution }),
      });
      await queryClient.invalidateQueries({ queryKey: syncKeys.all });
      await invalidateLedger();
    });

  const runBayesAutoCategorizer = () =>
    runAction(async () => {
      let bodyPayload: Record<string, string> = {};
      if (typeof window !== 'undefined' && family.id) {
        try {
          const raw = window.localStorage.getItem(`sure:ai_prompts:${family.id}`);
          if (raw) {
            const parsed = JSON.parse(raw) as {
              categorizerProvider?: string;
              categorizerModel?: string;
              categorizer?: string;
            };
            if (parsed.categorizerProvider) {
              bodyPayload.provider = parsed.categorizerProvider;
            }
            if (parsed.categorizerModel) {
              bodyPayload.model = parsed.categorizerModel;
            }
            if (parsed.categorizer) {
              bodyPayload.systemPrompt = parsed.categorizer;
            }
          }
        } catch {
          // Ignore storage read errors
        }
      }
      const res = await apiRequest<{ categorizedCount: number }>('/api/v1/ai/categorize', {
        method: 'POST',
        body: JSON.stringify(bodyPayload),
      });
      await invalidateLedger();
      return res.categorizedCount;
    });

  const isLoading =
    accountsQuery.isLoading || taxonomiesQuery.isLoading || entriesQuery.isLoading;

  return (
    <LedgerContext.Provider
      value={{
        isLoading,
        lastError,
        clearError: () => setLastError(null),
        family,
        updateFamilySettings,
        inviteFamilyMember,
        setupMfa,
        enableMfa,
        changePassword,
        downloadFamilyBackup,
        createApiKey,
        deleteApiKey,
        accounts,
        categories,
        merchants,
        tags,
        entries,
        rules,
        imports,
        goals,
        recurring,
        conflicts,
        syncAdapters: syncQuery.data?.adapters ?? [],
        syncConnections: syncQuery.data?.connections ?? [],
        insights,
        reportData: reportsQuery.data ?? null,
        budgetMonth,
        setBudgetMonth,
        budgetRows: budgetsQuery.data?.categories ?? [],
        budgetRolloverEnabled,
        setBudgetRolloverEnabled,
        budgetAllocations,
        updateBudgetAllocation,
        summary,
        createAccount,
        deleteAccount,
        fetchAccountHoldings,
        upsertAccountHolding,
        createEntry,
        updateEntry,
        deleteEntries,
        splitEntry,
        createTransfer,
        matchTransfer,
        fetchTransferSuggestions,
        bulkCategorizeEntries,
        bulkToggleExcludeEntries,
        createCategory,
        createMerchant,
        createTag,
        previewImportFile,
        commitStagedImport,
        commitImportBatch,
        revertImportBatch,
        createRule,
        toggleRuleActive,
        deleteRule,
        dryRunRule,
        applyAllRules,
        createGoal,
        deleteGoal,
        createRecurringBill,
        markRecurringPaid,
        deleteRecurringBill,
        connectProvider,
        runSyncAll,
        resolveConflict,
        runBayesAutoCategorizer,
      }}
    >
      {children}
    </LedgerContext.Provider>
  );
};

export function useLedger(): LedgerContextValue {
  const ctx = useContext(LedgerContext);
  if (!ctx) {
    throw new Error('useLedger must be used inside LedgerProvider');
  }
  return ctx;
}
