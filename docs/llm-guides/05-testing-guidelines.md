# 05 — Testing & CI/CD Guidelines

## 1. Testing Stack & Scope
- **Unit Tests (`*.spec.ts` — Vitest):**
  - Mandatory for pure financial logic, crypto, OpenAPI docs, and AI cost math:
    - `@sure/shared`: `packages/shared/src/math/decimal.spec.ts` (`Decimal` math, expressions, budget rollover, amortization).
    - `@sure/api`: `auth.crypto.spec.ts`, `balance.spec.ts`, `rules.spec.ts`, `ai.usage.spec.ts`, `openapi.spec.ts`.
  - Run unit suites quickly without PostgreSQL via:
    - `pnpm --filter @sure/shared test`
    - `pnpm --filter @sure/api exec vitest run src/modules/auth/auth.crypto.spec.ts src/modules/balances/balance.spec.ts src/modules/rules/rules.spec.ts src/modules/ai/ai.usage.spec.ts src/docs/openapi.spec.ts`
- **API Integration Tests (`*.test.ts` — Vitest + Supertest + PostgreSQL):**
  - e.g., `apps/api/src/modules/entries/entries.test.ts`.
  - Requires `DATABASE_URL` pointing to a running PostgreSQL 16+ instance (and `REDIS_URL`) with Prisma schema applied (`pnpm --filter @sure/api exec prisma db push --skip-generate`).
- **End-to-End Tests (`apps/web/e2e/*.spec.ts` — Playwright):**
  - Verify critical flows: auth, account creation, transactions, CSV import, budgets, and privacy mode toggle.

## 2. Mandatory Security & Financial Edge Cases
Every domain test suite MUST verify:
1. **Cross-Tenant Isolation:** User A from `Family 1` receives `404 Not Found` (not `403`, to prevent ID enumeration) when attempting to read, update, or delete resources belonging to `Family 2`.
2. **Decimal Precision & Sign Invariants:** Test `0.0000`, negative inflows/outflows (refunds), liability sign inversion (`flowsFactor = -1`), split remainder allocation accuracy, and multi-currency precision.
3. **Ledger Side Effects:** Creating, editing, splitting, matching/deleting transfers, or committing/reverting imports MUST assert accurate updates to `Account.balance` and `account_balances`.
4. **AI Consent & Usage Guardrails:** External LLM features must block or stay local unless `family.aiEnabled === true`; `estimateLlmCostUsd` and `summarizeLlmUsage` must safely handle custom/self-hosted models (`"N/A"` / `null` cost excluded from averages).

## 3. Prisma Environment & CI Pipeline (`.github/workflows/ci.yml`)
- **Prisma CLI Requirement:** `prisma/schema.prisma` reads `env("DATABASE_URL")`. Any environment running `prisma validate` or PostgreSQL integration tests MUST define `DATABASE_URL`.
- **GitHub Actions CI (`.github/workflows/ci.yml` on `main` and `dev`):**
  1. `quality`: Runs `prisma:generate`, `prisma validate` (with CI `DATABASE_URL`), `pnpm lint`, `pnpm typecheck`, and `pnpm build` via Turborepo across `@sure/shared`, `@sure/ui`, `@sure/api`, and `@sure/web`.
  2. `test`: Spins up `postgres:16-alpine` + `redis:7-alpine` service containers, pushes Prisma schema (`prisma db push --skip-generate`), and executes `pnpm test` (`@sure/shared` + `@sure/api` unit and PostgreSQL integration tests).
  3. `e2e` (manual `workflow_dispatch` with `run_e2e=true` or `vars.ENABLE_E2E == 'true'`): Seeds DB, boots API + Web servers, and runs `pnpm --filter @sure/web exec playwright test`.
