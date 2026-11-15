import React, { createContext, useContext, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from './api-client.js';
import {
  accountKeys,
  budgetKeys,
  goalKeys,
  reportKeys,
  ruleKeys,
  syncKeys,
  transactionKeys,
} from './query-keys.js';
import { useAuth } from '../features/auth/AuthContext.js';
import {
  buildBudgetAllocationsMap,
  computeLedgerSummary,
  mapAccountsResponse,
  mapConflictsResponse,
  mapEntriesResponse,
} from './ledger/mappers.js';
import type {
  ApiAccountsResponse,
  ApiBudgetResponse,
  ApiEntryItem,
  ApiSyncResponse,
  ApiTaxonomiesResponse,
  LedgerContextValue,
  WebGoal,
  WebImportBatch,
  WebInsight,
  WebRecurring,
  WebReportData,
  WebRule,
} from './ledger/types.js';
import { useLedgerActions } from './ledger/useLedgerActions.js';

export type {
  WebAccount,
  WebCategory,
  WebMerchant,
  WebTag,
  WebSplitItem,
  WebEntry,
  WebRule,
  WebImportBatch,
  WebGoal,
  WebRecurring,
  WebConflict,
  WebInsight,
  WebReportData,
  WebProviderAdapter,
  WebProviderConnection,
  WebMarketQuote,
  WebExchangeRateItem,
  WebAccountHolding,
  WebHoldingsSummary,
  WebTransferSuggestion,
  LedgerContextValue,
} from './ledger/types.js';

const LedgerContext = createContext<LedgerContextValue | null>(null);

export const LedgerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session, refreshSession } = useAuth();
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

  const accounts = useMemo(() => mapAccountsResponse(accountsQuery.data), [accountsQuery.data]);
  const categories = taxonomiesQuery.data?.categories ?? [];
  const merchants = taxonomiesQuery.data?.merchants ?? [];
  const tags = taxonomiesQuery.data?.tags ?? [];
  const entries = useMemo(() => mapEntriesResponse(entriesQuery.data), [entriesQuery.data]);
  const conflicts = useMemo(() => mapConflictsResponse(syncQuery.data), [syncQuery.data]);
  const budgetRolloverEnabled = budgetsQuery.data?.rolloverEnabled ?? true;
  const budgetAllocations = useMemo(
    () => buildBudgetAllocationsMap(budgetsQuery.data),
    [budgetsQuery.data]
  );
  const summary = useMemo(
    () => computeLedgerSummary(accountsQuery.data, reportsQuery.data, entries),
    [accountsQuery.data, reportsQuery.data, entries]
  );

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

  const actions = useLedgerActions({
    familyId: family.id,
    budgetMonth,
    budgetRolloverEnabled,
    budgetAllocations,
    expectedIncome: budgetsQuery.data?.expectedIncome,
    categories,
    refreshSession,
    setLastError,
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
        accounts,
        categories,
        merchants,
        tags,
        entries,
        rules: rulesQuery.data ?? [],
        imports: importsQuery.data ?? [],
        goals: goalsQuery.data ?? [],
        recurring: recurringQuery.data ?? [],
        conflicts,
        syncAdapters: syncQuery.data?.adapters ?? [],
        syncConnections: syncQuery.data?.connections ?? [],
        marketQuotes: syncQuery.data?.marketQuotes ?? [],
        exchangeRates: syncQuery.data?.exchangeRates ?? [],
        familyHoldings: syncQuery.data?.familyHoldings ?? [],
        insights: insightsQuery.data ?? [],
        reportData: reportsQuery.data ?? null,
        budgetMonth,
        setBudgetMonth,
        budgetRows: budgetsQuery.data?.categories ?? [],
        budgetRolloverEnabled,
        budgetAllocations,
        summary,
        ...actions,
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
