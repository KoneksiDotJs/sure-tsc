# 01 — Architecture & Financial Domain Guide

## 1. Modular Monorepo Architecture
All workspaces (`@sure/shared`, `@sure/ui`, `@sure/api`, `@sure/web`) follow modular single-responsibility design:
- Keep files focused and cohesive by splitting large monoliths into single-purpose modules (`core.ts`, `expression.ts`, `amortization.ts`, `budget.ts`, `format.ts`, domain sub-services, view sub-components, and pure calculation hooks).
- Expose thin barrels or facades (`decimal.ts`, `locales.ts`, `auth.service.ts`, `ai.service.ts`, `ledger-context.tsx`, `SettingsView.tsx`) to preserve stable imports and backwards compatibility.
- Keep relative TypeScript imports ESM-compatible using explicit `.js` extensions (`import { ... } from './sub-module.js'`).

### `packages/shared/src/` Structure
- `i18n/`: `currencies.ts`, `languages.ts`, `messages.en.ts`, `messages.id.ts`, re-exported via `locales.ts`.
- `math/`: `core.ts`, `expression.ts`, `amortization.ts`, `budget.ts`, `format.ts`, re-exported via `decimal.ts`.
- `schemas/`: `common.schema.ts`, `auth.schema.ts`, `account.schema.ts`, `entry.schema.ts`, `domain.schema.ts`.

## 2. Multi-Tenancy Model (`Family`)
- Every user belongs to a `Family` via `FamilyMembership` (`role: OWNER | ADMIN | MEMBER`).
- `Family` owns: `accounts`, `categories`, `merchants`, `tags`, `budgets`, `goals`, `rules`, `providerConnections`, `chats`, and `llmUsageEvents`.
- Every query, mutation, background job, and AI telemetry event reading or writing financial data MUST scope by `familyId` derived from the authenticated session.

## 3. Polymorphic Accounts (`Account`)
PostgreSQL models accounts in a single `accounts` table using `accountType`, `classification` (`ASSET | LIABILITY`), and a Zod-validated `subtypeDetails` JSONB column:
- `DEPOSITORY` (checking, savings, cash)
- `CREDIT_CARD` (creditLimit, apr, dueDay)
- `INVESTMENT` (brokerage, retirement — holds `Holding` and `Trade` entries)
- `CRYPTO` (exchange or on-chain wallet address/chain)
- `PROPERTY` (address, purchasePrice, valuationSource)
- `VEHICLE` (make, model, year, mileage)
- `LOAN` (principal, interestRate, termMonths, rateType)
- `OTHER_ASSET` / `OTHER_LIABILITY`

## 4. Polymorphic Ledger (`Entry`)
Every financial event is an `Entry` belonging to an `Account` (`date`, `amount`, `currency`, `name`, `entryType`):
- **`TRANSACTION`:** Cash inflow/outflow. Links to `categoryId`, `merchantId`, `tags`, optional `transferMatchId` (paired internal transfer), and optional `parentEntryId` (split transactions). Reports and Budgets MUST aggregate leaf entries only (counting split children and excluding split parents with children).
- **`VALUATION`:** Point-in-time balance anchor (`OPENING | RECONCILIATION | MARKET`).
- **`TRADE`:** Investment/crypto buy, sell, dividend, or split (`securityId`, `qty`, `price`, `fees`).

## 5. Balance Calculation Engine (`BalanceService`)
- **Forward & Reverse Materialization:** Calculates forward from opening/earliest `VALUATION` or backwards from `RECONCILIATION` anchors, storing daily end-of-day snapshots in `account_balances (accountId, date, balance, balanceInFamilyCurrency)`.
- **Liability Flow Sign Inversion:** `BalanceService.computeDailySeries` applies `flowsFactor = -1` for `LIABILITY` accounts so charges increase debt and payments reduce debt.
- **Destination-Aware Transfer Classification:** Transfers into `CREDIT_CARD`, `DEPOSITORY`, or `OTHER_LIABILITY` (and investment-to-investment transfers) exclude both legs (`excluded: true`); `loan_payment` and `investment_contribution` keep `outflow.excluded = false` and `inflow.excluded = true`. Deleting either paired leg releases `excluded: false` on the survivor.

## 6. Decimal Arithmetic Rules
```typescript
import Decimal from 'decimal.js';

// Configured in packages/shared/src/math/core.ts
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_EVEN });

// GOOD — Use packages/shared Decimal helpers (addMoney, subMoney, mulMoney, divMoney, sumMoney)
const total = new Decimal(entry.amount).plus(new Decimal(fee));

// BAD — Never use native JS number for money arithmetic
const total = Number(entry.amount) + Number(fee);
```

## 7. AI Privacy & LLM Usage Telemetry
- Never transmit family financial records to external LLM providers unless `family.aiEnabled === true`.
- Persist AI request token counts and estimated USD costs in `LlmUsageEvent` (`Chat`, `Categorize`, `Test`) via non-blocking `recordLlmUsageEvent()` in `apps/api/src/modules/ai/ai.usage.tracker.ts`.
