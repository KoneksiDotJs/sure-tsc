# AGENTS.md

This repository is a TypeScript full-stack re-engineering of **Sure** (formerly Maybe Finance), a multi-tenant personal finance and wealth management platform. All AI coding assistants (Claude, Cursor, Gemini, Copilot) must follow the architectural invariants and conventions defined here.

## Tech Stack
- **Monorepo:** `pnpm` workspaces + Turborepo
- **Frontend (`apps/web`):** React 19, TypeScript (strict), Vite, Tailwind CSS, TanStack Query v5, React Hook Form, Zod, D3 / Recharts
- **Backend (`apps/api`):** Node.js, Express, TypeScript (strict), Zod, Prisma ORM, BullMQ + Redis
- **Database:** PostgreSQL 16+
- **Shared Packages:** `packages/shared` (Zod schemas, DTO types, Decimal math utilities), `packages/ui` (Sure Design System components)
- **Testing:** Vitest (unit & API integration), Playwright (E2E)

## Repository Structure
```text
apps/
  api/                  # Express REST API v1, Prisma schema, BullMQ workers
    prisma/             # schema.prisma & migrations
    src/
      config/           # Env validation, logger, Redis/DB clients
      middleware/       # Auth, family tenant isolation, Zod validator, error handler
      modules/          # Domain modules (accounts, ai, auth, balances, budgets, entries, imports, mcp, reports, rules, sync)
      jobs/             # BullMQ queue definitions & processors
  web/                  # React SPA
    src/
      app/              # Router, providers (QueryClient, Theme, PrivacyMode)
      features/         # Domain feature modules matching backend domains
      lib/              # Typed API client, formatters, Decimal helpers
packages/
  shared/               # Shared Zod schemas, enums, currency/date/math helpers
  ui/                   # Design System primitives (Card, DataTable, MoneyField, Pill, etc.)
docs/
  llm-guides/           # Deep-dive implementation rules (read before editing domain code)
```

## Non-Negotiable Invariants
1. **Never Use Native JS `number` for Money Arithmetic:**
   - JavaScript IEEE-754 floats cause rounding errors. Always use `Decimal` (`decimal.js` / `Prisma.Decimal`) for calculations and store monetary columns as `DECIMAL(19, 4)` in PostgreSQL.
   - Serialize money in JSON APIs as strings (e.g., `"1250.5000"`) or structured `{ amount: string, currency: string }` objects.
2. **Strict Multi-Tenant Isolation (`familyId`):**
   - The root ownership entity is `Family`, not `User`.
   - Every query, mutation, and background job touching financial data MUST scope by `familyId` derived from the authenticated session (`req.auth.familyId`). Never trust a client-supplied `familyId` without authorization checks.
3. **Polymorphic Ledger & Reporting Integrity:**
   - Financial history is modeled via `Account` (`accountType` + `classification: ASSET | LIABILITY`) and `Entry` (`TRANSACTION | VALUATION | TRADE`).
   - Any mutation to `Entry` records (create, update, delete, transfer, split, bulk edit, import) MUST trigger balance recalculation (`BalanceService`) and materialize daily snapshots (`account_balances`).
   - **Liability Flow Sign Inversion:** `BalanceService.computeDailySeries` applies `flowsFactor = -1` for `LIABILITY` accounts so charges increase debt and inflows/payments reduce debt (`Balance::BaseCalculator#flows_factor`).
   - **Leaf-Only Split Attribution:** Reports and Budgets MUST aggregate leaf `TRANSACTION` entries (counting split children across their categories and excluding split parents with children).
   - **Destination-Aware Transfer Classification:** Transfers into `CREDIT_CARD`, `DEPOSITORY`, or `OTHER_LIABILITY` (and investment-to-investment transfers) exclude both legs (`excluded: true`); transfers into `LOAN` (`loan_payment`) or non-investment → `INVESTMENT`/`CRYPTO` (`investment_contribution`) keep `outflow.excluded = false` and `inflow.excluded = true`. Deleting either paired leg MUST release `excluded: false` on the surviving leg.
   - **Import Rules & Split Remainder Precision:** `commitImport` evaluates active family rules before balance materialization; split-ratio rules assign `subMoney(parentAmount, allocatedSoFar)` to the final child so child sums match the parent exactly.
4. **Thin Controllers & Thin Views:**
   - Express controllers only parse validated inputs, invoke a Service method, and return the standard API envelope.
   - React components only render UI and bind to TanStack Query hooks; keep financial transformations and filtering logic in pure functions or custom hooks.
5. **Privacy & AI Consent:**
   - Respect `PrivacyMode` on all monetary UI displays.
   - Never send user financial records to external LLM providers (OpenAI/Anthropic) unless `family.aiEnabled === true`.

## Contextual LLM Guides (Read Before Coding)
Before modifying specific areas of the codebase, read the corresponding guide in `docs/llm-guides/`:
- **Domain Modeling, Ledger, Balance Engine, DB Schema:** `docs/llm-guides/01-architecture-and-domain.md`
- **Express Routes, Services, Repositories, Prisma, BullMQ:** `docs/llm-guides/02-backend-express-api.md`
- **React Components, TanStack Query, Forms, Charts:** `docs/llm-guides/03-frontend-react-conventions.md`
- **Tailwind Tokens, Typography (`Geist` / `Geist Mono`), `packages/ui`:** `docs/llm-guides/04-design-system-ui.md`
- **Writing Unit, Integration, and E2E Tests:** `docs/llm-guides/05-testing-guidelines.md`

## Standard Commands
- `pnpm dev` — Run `apps/web` (`:5173`) and `apps/api` (`:4000`) concurrently
- `pnpm build` — Build all workspace packages (`@sure/shared`, `@sure/ui`, `@sure/api`, `@sure/web`) via Turborepo
- `pnpm typecheck` — Run `tsc --noEmit` across all workspaces
- `pnpm lint` — Run package lint checks across workspaces
- `pnpm test` — Run Vitest unit & PostgreSQL integration test suites (`turbo run test --force` to bypass cache)
- `pnpm --filter @sure/api run prisma:migrate` — Create and apply PostgreSQL migrations