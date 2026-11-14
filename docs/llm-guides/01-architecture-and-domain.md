# 01 — Architecture & Financial Domain Guide

## 1. Multi-Tenancy Model (`Family`)
- Every user belongs to a `Family` via `FamilyMembership` (`role: OWNER | ADMIN | MEMBER`).
- `Family` owns: `accounts`, `categories`, `merchants`, `tags`, `budgets`, `goals`, `rules`, `providerConnections`, and `chats`.
- Granular sharing (`AccountShare`, `BudgetShare`) restricts visibility for `MEMBER` users when configured.

## 2. Polymorphic Accounts (`Account`)
Instead of Ruby on Rails `delegated_type`, PostgreSQL models accounts with a single `accounts` table using an `accountType` enum and a validated `subtypeDetails` JSONB column (validated per type via Zod discriminated unions in `packages/shared`):
- `DEPOSITORY` (checking, savings, cash)
- `CREDIT_CARD` (creditLimit, apr, dueDay)
- `INVESTMENT` (brokerage, retirement — holds `Holding` and `Trade` entries)
- `CRYPTO` (exchange or on-chain wallet address/chain)
- `PROPERTY` (address, purchasePrice, valuationSource)
- `VEHICLE` (make, model, year, mileage)
- `LOAN` (principal, interestRate, termMonths, rateType)
- `OTHER_ASSET` / `OTHER_LIABILITY`

## 3. Polymorphic Ledger (`Entry`)
Every financial event is an `Entry` belonging to an `Account` (`date`, `amount`, `currency`, `name`, `entryType`):
- **`TRANSACTION`:** Cash inflow/outflow. Links to `categoryId`, `merchantId`, `tags`, optional `transferId` (paired internal transfer), and optional `parentEntryId` (for split transactions).
- **`VALUATION`:** Point-in-time balance anchor (`OPENING | RECONCILIATION | MARKET`). Overrides or anchors balance calculations on that date.
- **`TRADE`:** Investment/crypto buy, sell, dividend, or split (`securityId`, `qty`, `price`, `fees`).

## 4. Balance Calculation Engine (`BalanceService`)
Replicates Rails `ForwardCalculator`, `ReverseCalculator`, and `Materializer`:
- **Manual / Synced Accounts (Forward):** Starts from the earliest `VALUATION` (or `0`) and cumulatively adds daily net `TRANSACTION` / `TRADE` flows up to today.
- **Anchor-Based Recalculation (Reverse):** When a user reconciles a current balance (`RECONCILIATION` valuation), calculate backwards from the anchor date to preserve historical accuracy.
- **Materialization:** Store daily end-of-day balances in `account_balances (accountId, date, balance, balanceInFamilyCurrency)` so dashboard net worth and sparkline queries read precomputed rows in `< 50ms`.

## 5. Decimal Arithmetic Rules
```typescript
import Decimal from 'decimal.js';

// Configure globally in packages/shared
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_EVEN });

// GOOD
const total = new Decimal(entry.amount).plus(new Decimal(fee));

// BAD — Never do this
const total = Number(entry.amount) + Number(fee);
```