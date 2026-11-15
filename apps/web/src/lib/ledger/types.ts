import {
  AccountClassification,
  AccountType,
  EntryType,
  ImportFormat,
  RecurringCadence,
  RuleAction,
  RuleCondition,
  TradeAction,
  ValuationKind,
} from '@sure/shared';

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
  supportsLiveSync?: boolean;
  description?: string;
}

export interface WebProviderConnectionConfigSummary {
  useTestnet: boolean;
  quoteCurrency: string | null;
  targetAccountId: string | null;
  tickers: string[];
  baseCurrency: string | null;
  targetCurrencies: string[];
}

export interface WebProviderConnection {
  id: string;
  providerKey?: string;
  providerName: string;
  providerCategory?: string;
  institutionName: string;
  status: string;
  lastSyncedAt: string | null;
  createdAt: string;
  supportsLiveSync?: boolean;
  hasCredentials?: boolean;
  maskedApiKey?: string | null;
  configSummary?: WebProviderConnectionConfigSummary;
}

export interface WebMarketQuote {
  id: string;
  ticker: string;
  name: string;
  currency: string;
  currentPrice: string;
  assetClass: string;
}

export interface WebExchangeRateItem {
  baseCurrency: string;
  targetCurrency: string;
  date: string;
  rate: string;
}

export interface WebFamilyHolding {
  id: string;
  accountId: string;
  accountName: string;
  accountType: string;
  currency: string;
  ticker: string;
  securityName: string;
  assetClass: string;
  qty: string;
  avgCostBasis: string;
  currentPrice: string;
  marketValue: string;
  costBasisTotal: string;
  unrealizedGain: string;
  returnPercent: string;
}

export type WebMarketHistoryRange = '5d' | '1mo' | '3mo' | '6mo' | '1y';

export interface WebMarketHistory {
  kind: 'security' | 'fx';
  symbol: string;
  name: string;
  currency: string;
  range: WebMarketHistoryRange;
  latestClose: string;
  periodOpen: string;
  changeAmount: string;
  changePercent: string;
  periodHigh: string;
  periodLow: string;
  points: Array<{ date: string; close: string }>;
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

export interface ApiAccountsResponse {
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

export interface ApiEntryItem {
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

export interface ApiTaxonomiesResponse {
  categories: WebCategory[];
  merchants: WebMerchant[];
  tags: WebTag[];
}

export interface ApiBudgetResponse {
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

export interface ApiSyncResponse {
  adapters: WebProviderAdapter[];
  connections: WebProviderConnection[];
  marketQuotes?: WebMarketQuote[];
  exchangeRates?: WebExchangeRateItem[];
  familyHoldings?: WebFamilyHolding[];
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

export interface LedgerContextValue {
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
  marketQuotes: WebMarketQuote[];
  exchangeRates: WebExchangeRateItem[];
  familyHoldings: WebFamilyHolding[];
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
    accountId?: string;
    config?: {
      apiKey?: string;
      apiSecret?: string;
      useTestnet?: boolean;
      quoteCurrency?: string;
      targetAccountId?: string;
      tickers?: string[];
      baseCurrency?: string;
      targetCurrencies?: string[];
    };
  }) => Promise<void>;
  updateProviderConnection: (
    connectionId: string,
    input: {
      institutionName?: string;
      accountId?: string | null;
      config?: {
        apiKey?: string;
        apiSecret?: string;
        useTestnet?: boolean;
        quoteCurrency?: string;
        targetAccountId?: string;
        tickers?: string[];
        baseCurrency?: string;
        targetCurrencies?: string[];
      };
    }
  ) => Promise<void>;
  deleteProviderConnection: (connectionId: string) => Promise<void>;
  syncProviderConnection: (connectionId: string) => Promise<{
    connectionId: string;
    providerKey: string;
    institutionName: string;
    ok: boolean;
    message: string;
    syncedAt: string;
  }>;
  runSyncAll: () => Promise<{
    syncedConnections: number;
    materializedAccounts: number;
    errors?: Array<{ connectionId: string; institutionName: string; message: string }>;
  }>;
  addWatchlistTicker: (ticker: string) => Promise<WebMarketQuote>;
  fetchMarketHistory: (query: {
    kind: 'security' | 'fx';
    ticker?: string;
    from?: string;
    to?: string;
    range?: WebMarketHistoryRange;
  }) => Promise<WebMarketHistory>;
  resolveConflict: (conflictId: string, resolution: string) => Promise<void>;
  runBayesAutoCategorizer: () => Promise<number>;
}
