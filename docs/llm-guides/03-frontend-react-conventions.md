# 03 — Frontend React & TypeScript Conventions

## 1. Directory & Feature Architecture (`apps/web/src/`)
- `features/<domain>/`:
  - `api/`: TanStack Query hooks (`useTransactionsQuery`, `useUpdateTransactionMutation`) and query key factories.
  - `components/`: Feature-specific UI (`TransactionTable`, `TransactionDrawer`, `SplitTransactionModal`).
  - `pages/`: Route-level page components (`TransactionsPage.tsx`).
- Keep `packages/ui` strictly domain-agnostic; domain components live in `apps/web/src/features/`.

## 2. Server State & Cache Invalidation (TanStack Query)
Define hierarchical query keys per feature so mutations invalidate related caches cleanly:
```typescript
export const transactionKeys = {
  all: ['transactions'] as const,
  lists: () => [...transactionKeys.all, 'list'] as const,
  list: (filters: TransactionFilters) => [...transactionKeys.lists(), filters] as const,
  detail: (id: string) => [...transactionKeys.all, 'detail', id] as const,
};
```
When a transaction is created, updated, split, or deleted, invalidate both `transactionKeys.lists()` AND `accountKeys.all` (since account balances and net worth charts depend on entries).

## 3. Forms & Validation
- Use `React Hook Form` + `@hookform/resolvers/zod` with schemas imported directly from `packages/shared`.
- Monetary inputs MUST use `<MoneyField />` from `packages/ui` (supports locale separators and inline math expressions like `45000 + 12500` evaluated on blur, matching `evaluate_amount_expression.js`).

## 4. Financial Formatting & Privacy Mode
- Always render monetary values through the shared `<MoneyAmount value={amount} currency={currency} />` component:
  - Uses `font-mono tabular-nums` (`Geist Mono`).
  - Applies semantic color classes (`text-status-positive` for inflows, `text-status-negative` for outflows).
  - Automatically applies `blur-sm select-none` when `usePrivacyMode().enabled === true`.
- Avoid unnecessary `useEffect` hooks for derived state; compute totals, chart series, and filter states via `useMemo` or directly during render.