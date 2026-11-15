import { useQueryClient } from '@tanstack/react-query';
import { absMoney } from '@sure/shared';
import { inferCategoryIconName } from '@sure/ui';
import { apiRequest } from '../api-client.js';
import {
  accountKeys,
  budgetKeys,
  goalKeys,
  reportKeys,
  ruleKeys,
  syncKeys,
  transactionKeys,
} from '../query-keys.js';
import { buildDefaultSubtypeDetails } from './mappers.js';
import type {
  LedgerContextValue,
  WebCategory,
  WebHoldingsSummary,
  WebMerchant,
  WebTag,
  WebTransferSuggestion,
} from './types.js';

interface UseLedgerActionsParams {
  familyId: string;
  budgetMonth: string;
  budgetRolloverEnabled: boolean;
  budgetAllocations: Record<string, string>;
  expectedIncome?: string;
  categories: WebCategory[];
  refreshSession: () => Promise<void>;
  setLastError: (msg: string | null) => void;
}

export function useLedgerActions(params: UseLedgerActionsParams) {
  const {
    familyId,
    budgetMonth,
    budgetRolloverEnabled,
    budgetAllocations,
    expectedIncome,
    categories,
    refreshSession,
    setLastError,
  } = params;
  const queryClient = useQueryClient();

  const invalidateLedger = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: accountKeys.all }),
      queryClient.invalidateQueries({ queryKey: transactionKeys.lists() }),
      queryClient.invalidateQueries({ queryKey: reportKeys.all }),
      queryClient.invalidateQueries({ queryKey: budgetKeys.all }),
      queryClient.invalidateQueries({ queryKey: ['ai', 'insights'] }),
    ]);
  };

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

  // Family & Security
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
      const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
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

  // Budgets, Goals & Recurring
  const persistBudget = async (nextRollover: boolean, nextAllocations: Record<string, string>) => {
    await apiRequest('/api/v1/budgets', {
      method: 'PUT',
      body: JSON.stringify({
        month: budgetMonth,
        expectedIncome: expectedIncome ?? '12500.0000',
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

  // Accounts & Holdings
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
    runAction(() => apiRequest<WebHoldingsSummary>(`/api/v1/accounts/${accountId}/holdings`));

  const upsertAccountHolding: LedgerContextValue['upsertAccountHolding'] = (accountId, input) =>
    runAction(async () => {
      const res = await apiRequest<WebHoldingsSummary>(
        `/api/v1/accounts/${accountId}/holdings`,
        { method: 'POST', body: JSON.stringify(input) }
      );
      await invalidateLedger();
      return res;
    });

  // Entries & Transfers
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

      await apiRequest('/api/v1/entries', { method: 'POST', body: JSON.stringify(payload) });
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

  const splitEntry: LedgerContextValue['splitEntry'] = (entryId, splits) =>
    runAction(async () => {
      await apiRequest(`/api/v1/entries/${entryId}/split`, {
        method: 'POST',
        body: JSON.stringify({
          splits: splits.map((s) => ({ name: s.name, amount: s.amount, categoryId: s.categoryId })),
        }),
      });
      await invalidateLedger();
    });

  const createTransfer: LedgerContextValue['createTransfer'] = (input) =>
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

  // Taxonomies
  const createCategory: LedgerContextValue['createCategory'] = (
    name,
    classification = 'EXPENSE',
    icon,
    color
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

  // Imports & Rules
  const previewImportFile: LedgerContextValue['previewImportFile'] = (reqParams) =>
    runAction(() =>
      apiRequest<Awaited<ReturnType<LedgerContextValue['previewImportFile']>>>(
        '/api/v1/imports/preview',
        { method: 'POST', body: JSON.stringify(reqParams) }
      )
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

      const preview = await apiRequest<{ importBatch: { id: string } }>('/api/v1/imports/preview', {
        method: 'POST',
        body: JSON.stringify({ accountId, format, fileName, rawContent }),
      });

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
      await apiRequest('/api/v1/rules', { method: 'POST', body: JSON.stringify(rule) });
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

  const dryRunRule: LedgerContextValue['dryRunRule'] = (reqParams) =>
    runAction(() =>
      apiRequest<Awaited<ReturnType<LedgerContextValue['dryRunRule']>>>(
        '/api/v1/rules/dry-run',
        { method: 'POST', body: JSON.stringify(reqParams) }
      )
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

  // Goals, Recurring, Sync & AI
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
      await apiRequest('/api/v1/recurring', { method: 'POST', body: JSON.stringify(input) });
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
      await apiRequest('/api/v1/sync/connections', { method: 'POST', body: JSON.stringify(input) });
      await queryClient.invalidateQueries({ queryKey: syncKeys.all });
      await invalidateLedger();
    });

  const updateProviderConnection: LedgerContextValue['updateProviderConnection'] = (
    connectionId,
    input
  ) =>
    runAction(async () => {
      await apiRequest(`/api/v1/sync/connections/${connectionId}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      });
      await queryClient.invalidateQueries({ queryKey: syncKeys.all });
      await invalidateLedger();
    });

  const deleteProviderConnection: LedgerContextValue['deleteProviderConnection'] = (connectionId) =>
    runAction(async () => {
      await apiRequest(`/api/v1/sync/connections/${connectionId}`, { method: 'DELETE' });
      await queryClient.invalidateQueries({ queryKey: syncKeys.all });
      await invalidateLedger();
    });

  const syncProviderConnection: LedgerContextValue['syncProviderConnection'] = (connectionId) =>
    runAction(async () => {
      const res = await apiRequest<{
        connectionId: string;
        providerKey: string;
        institutionName: string;
        ok: boolean;
        message: string;
        syncedAt: string;
      }>(`/api/v1/sync/connections/${connectionId}/sync`, { method: 'POST' });
      await queryClient.invalidateQueries({ queryKey: syncKeys.all });
      await invalidateLedger();
      return res;
    });

  const runSyncAll = () =>
    runAction(async () => {
      const res = await apiRequest<{
        syncedConnections: number;
        materializedAccounts: number;
        errors?: Array<{ connectionId: string; institutionName: string; message: string }>;
      }>('/api/v1/sync/run', { method: 'POST' });
      await queryClient.invalidateQueries({ queryKey: syncKeys.all });
      await invalidateLedger();
      return res;
    });

  const addWatchlistTicker: LedgerContextValue['addWatchlistTicker'] = (ticker) =>
    runAction(async () => {
      const res = await apiRequest<{ quote: LedgerContextValue['marketQuotes'][number] }>(
        '/api/v1/sync/watchlist',
        {
          method: 'POST',
          body: JSON.stringify({ ticker }),
        }
      );
      await queryClient.invalidateQueries({ queryKey: syncKeys.all });
      return res.quote;
    });

  const fetchMarketHistory: LedgerContextValue['fetchMarketHistory'] = async (query) => {
    const params = new URLSearchParams();
    params.set('kind', query.kind);
    if (query.ticker) params.set('ticker', query.ticker);
    if (query.from) params.set('from', query.from);
    if (query.to) params.set('to', query.to);
    if (query.range) params.set('range', query.range);
    return apiRequest<Awaited<ReturnType<LedgerContextValue['fetchMarketHistory']>>>(
      `/api/v1/sync/markets/history?${params.toString()}`
    );
  };

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
      const bodyPayload: Record<string, string> = {};
      if (typeof window !== 'undefined' && familyId) {
        try {
          const raw = window.localStorage.getItem(`sure:ai_prompts:${familyId}`);
          if (raw) {
            const parsed = JSON.parse(raw) as {
              categorizerProvider?: string;
              categorizerModel?: string;
              categorizer?: string;
            };
            if (parsed.categorizerProvider) bodyPayload.provider = parsed.categorizerProvider;
            if (parsed.categorizerModel) bodyPayload.model = parsed.categorizerModel;
            if (parsed.categorizer) bodyPayload.systemPrompt = parsed.categorizer;
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

  return {
    updateFamilySettings,
    inviteFamilyMember,
    setupMfa,
    enableMfa,
    changePassword,
    downloadFamilyBackup,
    createApiKey,
    deleteApiKey,
    setBudgetRolloverEnabled,
    updateBudgetAllocation,
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
    updateProviderConnection,
    deleteProviderConnection,
    syncProviderConnection,
    runSyncAll,
    addWatchlistTicker,
    fetchMarketHistory,
    resolveConflict,
    runBayesAutoCategorizer,
  };
}
