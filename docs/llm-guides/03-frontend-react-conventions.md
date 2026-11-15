# 03 — Frontend React & TypeScript Conventions

## 1. Modular Directory & Feature Architecture (`apps/web/src/`)
Keep top-level views and shells thin and compose focused feature components and hooks:
- `app/`:
  - `App.tsx`: Thin shell wiring `AuthProvider`, `LedgerProvider`, drawer/modal visibility, and active tab view.
  - `app/components/`: `navigation.ts`, `AppAccountSidebar.tsx`, `AppRailAndNav.tsx`, `AppHeader.tsx`, `QuickJumpModal.tsx`, and `useWorkspaceAiChat.ts`.
- `lib/ledger/`:
  - Split shared ledger state into `types.ts`, `mappers.ts`, and `useLedgerActions.ts`, exposed through the `LedgerContext` facade in `lib/ledger-context.tsx`.
- `features/<domain>/`:
  - Break every feature module into focused sub-components under `components/` (or domain subfolders like `settings/{general,transactions,advanced}/`):
    - `accounts/`: `AccountsView.tsx` + `components/{accountHistory.ts,AccountBalanceHero.tsx,AccountActivityTab.tsx,AccountStatementsTab.tsx,AccountHoldingsAndLoanTabs.tsx,AccountEntryDialogs.tsx}`
    - `ai/`: `AiAssistantPanel.tsx` + `components/MarkdownMessageBody.tsx`
    - `auth/`: `AuthPage.tsx`, `AuthContext.tsx` + `components/{AuthForms.tsx,MfaAndRecoveryPanels.tsx}`
    - `budgets/`: `BudgetsAndGoalsView.tsx` + `components/{MonthlyBudgetsSection.tsx,FinancialGoalsSection.tsx,RecurringBillsSection.tsx}`
    - `dashboard/`: `DashboardView.tsx` + `components/{useDashboardMetrics.ts,CashflowSankeyCard.tsx,OutflowsDonutCard.tsx,NetWorthAndTrendColumn.tsx,BalanceSheetBreakdownCard.tsx,RecentActivityAndInsightsRow.tsx}`
    - `imports/`: `ImportsAndRulesView.tsx` + `components/{ImportWizardSection.tsx,RulesEngineSection.tsx}`
    - `reports/`: `ReportsAndSyncView.tsx` + `components/{InvestmentReportCard.tsx,SyncConnectionsAndConflicts.tsx}`
    - `settings/`: `SettingsView.tsx`, `settings.nav.ts`, `MoreSettingsSections.tsx`, plus decomposed sections under `general/`, `transactions/`, and `advanced/` (with thin re-exports in `TransactionsSettingsSections.tsx` and `AdvancedSettingsSections.tsx`)
    - `transactions/`: `TransactionsView.tsx` + `components/{transactionColumns.tsx,EntryInspectorDrawer.tsx,SplitTransactionDialog.tsx,TransferMatchDialog.tsx,CreateEntryDialog.tsx}`
- Keep `packages/ui` strictly domain-agnostic; all financial domain bindings live in `apps/web/src/features/` or `apps/web/src/lib/`.
- When decomposing feature components or hooks, extract pure transformations/calculations into helper files or custom hooks (e.g., `useDashboardMetrics.ts`, `accountHistory.ts`) rather than embedding heavy computations directly in JSX views.

## 2. State Synchronization & Cache Rules
- Derive filtered lists, chart series, and KPI totals with `useMemo` or pure functions rather than redundant `useEffect` state sync.
- Keep modal-local form state (create/edit/split/transfer/recovery dialogs) inside the dialog component itself so parent view re-renders stay minimal.
- Refresh ledger data and `account_balances`-backed metrics after every entry, transfer, split, import, or rule mutation.

## 3. AI Chatbot & LLM Usage UX Conventions
- **`AiAssistantPanel.tsx`:**
  - Fetch active model metadata from `/api/v1/ai/config` to display the active provider/model status badge and pill tags on assistant responses.
  - Display a reasoning/buffering indicator with elapsed timer while awaiting model responses (`isSending === true`).
  - Render Markdown headings, lists, inline code/emphasis, and pipe tables via `MarkdownMessageBody.tsx` with horizontal overflow protection.
  - Enforce the opt-in consent gate overlay whenever `family.aiEnabled === false`.
  - Dispatch `sure:ai-usage-updated` after chat responses so `LlmUsageSection.tsx` stays synchronized without full-page reloads.
- **`LlmUsageSection.tsx` (`Settings → Advanced → LLM Usage`):**
  - Query `/api/v1/ai/usage` by date range, show request/token/cost KPI cards (prompt vs. completion breakdown) and recent usage rows, and blur USD costs when `usePrivacyMode().enabled === true`.

## 4. Forms, Formatting & TypeScript Rules
- Validate payloads with Zod schemas imported from `@sure/shared`.
- Monetary inputs MUST use `<MoneyField />` (supports locale separators and inline math expressions evaluated on blur).
- Always render currency amounts with `<MoneyAmount value={amount} currency={currency} />` (`Geist Mono` tabular numerals + automatic `PrivacyMode` blur).
- Use `.js` extensions on relative imports in `apps/web/src/` (TypeScript strict mode, `tsc --noEmit` must pass with zero unused locals/imports).
