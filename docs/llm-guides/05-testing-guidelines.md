# 05 — Testing Guidelines

## 1. Testing Stack & Scope
- **Unit Tests (`*.spec.ts` — Vitest):**
  - Mandatory for all pure financial logic: `Decimal` currency conversions, `BalanceService` (forward/reverse calculators), `Loan` amortization schedules, `Portfolio` XIRR calculations, `Budget` rollover math, and `RuleEngine` condition evaluators.
- **API Integration Tests (`*.test.ts` — Vitest + Supertest + PostgreSQL Test DB):**
  - Mandatory for every Express endpoint.
  - Run against an isolated PostgreSQL database wrapped in transaction rollbacks or schema truncation between suites.
- **End-to-End Tests (`apps/web/e2e/*.spec.ts` — Playwright):**
  - Cover critical user journeys: onboarding & family creation, creating manual accounts/transactions, CSV import wizard, budget creation, and privacy mode toggle.

## 2. Mandatory Security & Financial Edge Cases
Every domain test suite must explicitly verify:
1. **Cross-Tenant Isolation:** User A from `Family 1` receives `404 Not Found` (not `403`, to prevent ID enumeration) when attempting to read, update, or delete resources belonging to `Family 2`.
2. **Decimal Precision & Negative Values:** Test `0.0000`, negative inflows/outflows (refunds), large balances (`999999999999.9999`), and multi-currency exchange rate rounding.
3. **Ledger Side Effects:** Creating, editing, splitting, or deleting an `Entry` must assert that the parent `Account.balance` and `account_balances` daily materialization match expected values.
4. **Idempotency:** Re-running a provider sync job or webhook event with the same external transaction ID must not create duplicate entries.

## 3. Test Data Factories
- Use deterministic factory helpers in `apps/api/src/test/factories/` (e.g., `createTestFamily()`, `createTestAccount()`, `createTestTransaction()`) rather than raw `prisma.*.create()` calls in every test file.