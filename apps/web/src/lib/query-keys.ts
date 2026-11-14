/**
 * Hierarchical TanStack Query Keys (`docs/llm-guides/03-frontend-react-conventions.md` Section 2)
 * When a transaction is created, updated, split, or deleted, invalidate both
 * `transactionKeys.lists()` AND `accountKeys.all`.
 */
export interface TransactionFilters {
  accountId?: string;
  entryType?: string;
  categoryId?: string;
  search?: string;
}

export const accountKeys = {
  all: ['accounts'] as const,
  lists: () => [...accountKeys.all, 'list'] as const,
  detail: (id: string) => [...accountKeys.all, 'detail', id] as const,
};

export const transactionKeys = {
  all: ['transactions'] as const,
  lists: () => [...transactionKeys.all, 'list'] as const,
  list: (filters: TransactionFilters) => [...transactionKeys.lists(), filters] as const,
  detail: (id: string) => [...transactionKeys.all, 'detail', id] as const,
};

export const budgetKeys = {
  all: ['budgets'] as const,
  month: (month: string) => [...budgetKeys.all, month] as const,
};

export const goalKeys = {
  all: ['goals'] as const,
};

export const ruleKeys = {
  all: ['rules'] as const,
};

export const reportKeys = {
  all: ['reports'] as const,
};

export const syncKeys = {
  all: ['sync'] as const,
};
