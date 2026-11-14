# Product Requirements Document (PRD) — Sure

## 1. Product Overview
* **Product Name:** Sure (re-engineered from the Sure / Maybe Finance open-source codebase)
* **Target Stack:** React 19 + Express + TypeScript (Monorepo) + PostgreSQL + Prisma ORM + Redis/BullMQ
* **Product Vision:** Deliver a self-hostable, multi-tenant personal finance and wealth management platform that consolidates banking, investments, cryptocurrency, real estate, vehicles, and liabilities into a unified polymorphic ledger with automated categorization, budgeting, forecasting, and AI-assisted financial workflows.

---

## 2. Multi-Tenancy & User Roles
* **Root Tenant (`Family`):** All financial entities—accounts, entries, categories, merchants, tags, budgets, goals, rules, and provider connections—are owned by a `Family` rather than an individual user.
* **Roles (`FamilyMembership`):**
  * **Owner / Admin:** Full read/write access to all family accounts, member invitations, billing/hosting settings, AI configuration, and data exports.
  * **Member:** Access scoped by explicit account-level (`AccountShare`) and budget-level (`BudgetShare`) permissions.
  * **Super Admin (Self-Hosted / Instance Operator):** System health monitoring, SSO provider management, and audited user impersonation (`ImpersonationSession`).

---

## 3. Target System Architecture
| Layer | Technology | Responsibilities |
| :--- | :--- | :--- |
| **Frontend (`apps/web`)** | React 19, TypeScript, Vite, Tailwind CSS, TanStack Query v5, React Hook Form, D3 / Recharts | SPA UI, client-side expression evaluation, interactive Sankey & time-series charts, Privacy Mode masking |
| **UI Library (`packages/ui`)** | React, TypeScript, Tailwind CSS, Radix Primitives | Sure Design System components (`Card`, `DataTable`, `MoneyField`, `Pill`, `Sparkline`, `ProgressRing`) |
| **Shared (`packages/shared`)** | TypeScript, Zod, `decimal.js` | Shared validation schemas, API DTO types, currency normalization, and high-precision financial math |
| **Backend API (`apps/api`)** | Node.js, Express, TypeScript, Zod | REST API (`/api/v1/*`), authentication, multi-tenant authorization, webhook ingestion, MCP server endpoint |
| **Database & Cache** | PostgreSQL 16+, Prisma ORM, Redis | Relational ledger storage (`DECIMAL(19, 4)`), daily balance materialization, session & rate-limit store |
| **Background Workers** | BullMQ + Redis | Scheduled bank/crypto syncs, rule batch execution, PDF statement extraction, proactive insight generation |

---

## 4. Functional Requirements

### FR-1: Authentication, Security & External Access
* **FR-1.1 Standard Auth:** Email/password registration, email verification, session management, and password reset flows.
* **FR-1.2 Multi-Factor & Passwordless:** TOTP-based MFA, WebAuthn/Passkey registration and login, and OIDC/SSO identity linking.
* **FR-1.3 API & MCP Integration:** Scoped personal `ApiKey` generation and OAuth 2.0 authorization endpoints to support external clients and Model Context Protocol (MCP) tools.

### FR-2: Polymorphic Accounts & Accounting Ledger
* **FR-2.1 Account Types (`Account`):** Support 9 account classifications with type-specific metadata:
  1. `DEPOSITORY` (checking, savings, cash)
  2. `CREDIT_CARD` (credit limit, APR, statement/due dates)
  3. `INVESTMENT` (brokerage, retirement accounts with `Holding` positions)
  4. `CRYPTO` (exchange accounts and on-chain wallets)
  5. `PROPERTY` (real estate with address and market valuation tracking)
  6. `VEHICLE` (make, model, year, valuation tracking)
  7. `LOAN` (principal, interest rate, term, amortization schedule, and extra-repayment payoff simulator)
  8. `OTHER_ASSET` & `OTHER_LIABILITY`
* **FR-2.2 Polymorphic Entries (`Entry`):** Every financial record is stored as an `Entry` tied to an `Account` (`date`, `amount`, `currency`, `name`) with one of three subtypes:
  * `TRANSACTION`: Standard cash inflows/outflows with category, merchant, tags, attachments, notes, and exclusion flags.
  * `VALUATION`: Point-in-time balance anchors (`OPENING`, `RECONCILIATION`, `MARKET`).
  * `TRADE`: Security/crypto buy, sell, dividend, or split events (`securityId`, `qty`, `price`).
* **FR-2.3 Balance Calculation & Materialization Engine:**
  * Support forward balance calculation from `OPENING`/`MARKET` valuations and reverse calculation from `RECONCILIATION` anchors, applying `flowsFactor = -1` for `LIABILITY` accounts (`CREDIT_CARD`, `LOAN`, `OTHER_LIABILITY`) so charges/expenses increase debt and payments/inflows reduce debt (`Balance::BaseCalculator#flows_factor` parity).
  * Materialize daily end-of-day balances in `account_balances` converted into the family's base currency via `ExchangeRate` records.
* **FR-2.4 Advanced Transaction Operations:**
  * **Split Transactions:** Divide a single parent transaction into multiple child entries across different categories; Reports and Budgets aggregate leaf entries only (counting split children and excluding split parents).
  * **Internal Transfers & Matching:** Create atomic paired transfers (`POST /api/v1/entries/transfers`) or link existing entries (`TransferMatch`), preserving Sure's destination-aware classification: `DEPOSITORY` and `CREDIT_CARD` transfers exclude both legs (`excluded: true`), whereas `LOAN` payments and non-investment → `INVESTMENT`/`CRYPTO` contributions keep the outflow leg un-excluded (`excluded: false`) as budgeted expenses while keeping the inflow leg excluded. Deleting either paired leg releases `excluded: false` on the surviving leg (`Transfer#release_transactions`).
  * **Bulk Actions:** Multi-select bulk categorization, tagging, merchant assignment, exclusion toggles, and bulk deletion.

### FR-3: Multi-Format Importer & Rule Engine
* **FR-3.1 Guided Import Wizard:** 4-step workflow (*Upload → Column Mapping → Clean/Preflight Review → Confirm*) supporting **CSV**, **QIF**, **OFX**, and **PDF Bank Statements**. Automatically evaluates active family rules on newly committed rows before balance materialization (`Import#confirm` parity), and supports full import rollback (`RevertImport`).
* **FR-3.2 Rule Engine (`Rule` & `RuleGroup`):**
  * **Conditions:** Evaluate transaction attributes (`merchant`, `name`, `notes`, `amount`, `account`, `transaction_type`) using operators (`equals`, `contains`, `starts_with`, `gt`, `lt`, `between`).
  * **Actions:** Automatically assign `category`, `merchant`, `tags`, rename `display_name`, toggle `excluded`, or apply predefined `split` ratios (assigning any rounding remainder to the final split child so child sums match the parent to `0.0001`).
  * **Dry-Run Preview:** Allow users to preview matching transactions before applying a rule to historical data.

### FR-4: Budgeting, Goals & Recurring Bills
* **FR-4.1 Monthly Budgeting (`Budget` & `BudgetCategory`):**
  * Assign monthly spending targets per category and track leaf actual spend (including split children) vs. budgeted amounts.
  * Walk full multi-month chronological **Rollover** chains (`RolloverCalculator`), resetting carry to `0.0000` when an intermediate month disables rollover.
* **FR-4.2 Financial Goals (`Goal`):**
  * Track savings or investment targets linked to fundable asset accounts (`GoalAccount`: `DEPOSITORY`, `INVESTMENT`, `CRYPTO`) where linked account balances dynamically drive goal progress in base currency, with day-precision pace & status (`REACHED`, `ON_TRACK`, `BEHIND`), progress rings, and goal deletion (`DELETE /api/v1/goals/:id`).
* **FR-4.3 Recurring Transactions & Bills (`RecurringTransaction`):**
  * Identify recurring subscriptions and bills, display Overview & Calendar views, detect price hikes, and mark occurrences paid to automatically generate ledger transactions and advance due dates.

### FR-5: Financial Reports & Data Visualization
* **FR-5.1 Customizable Dashboard:** Modular widget layout supporting *Net Worth Sparkline*, *Cash Flow*, *Income vs. Expenses*, and *Recent Activity*.
* **FR-5.2 Balance Sheet:** Asset vs. liability breakdown, net worth velocity, and historical net worth trend chart.
* **FR-5.3 Income Statement, Spending vs. Normal & Cash Flow Sankey:** Leaf-accurate income vs. expense breakdown, current-month **Spending vs. Normal** comparison against up to 12 prior months per category, and an interactive D3/SVG **Sankey diagram** visualizing income flowing into expense categories and net savings.

### FR-6: External Provider Sync & FinanceKit Normalization
* **FR-6.1 Provider Adapter Architecture:** Unified `ProviderAdapter` interface supporting banking aggregators (Plaid, TrueLayer, Enable Banking, SimpleFIN, Akahu, Wise, Mercury, Brex, Monobank, Fio, Up, Lunchflow, Sophtron, Redbark), crypto exchanges/wallets (Binance, Coinbase, CoinSpot, CoinStats, Kraken, EVM/Bitcoin/Solana/Cosmos/Polkadot on-chain adapters), and brokerages/market data (IBKR, Questrade, Trading 212, Trade Republic, Sharesight, Indexa Capital, Yahoo Finance, Twelve Data, EODHD, Alpha Vantage, Frankfurter).
* **FR-6.2 FinanceKit Staging & Conflict Resolution:** Stage incoming provider payloads (`FinancekitBatch`, `FinancekitItem`) and surface duplicate or account-mapping conflicts (`FinancekitConflict`) for user resolution before committing to the ledger.

### FR-7: AI Financial Assistant & Proactive Insights
* **FR-7.1 Local & LLM Categorization:** Combine local Naive Bayes classification (`BayesCategorizer`) with optional OpenAI/Anthropic structured-output categorization and merchant detection.
* **FR-7.2 AI Chat with Tool Calling:** Conversational assistant (`Chat`, `Message`) capable of invoking read/write tools (`get_accounts`, `get_transactions`, `get_budget`, `get_balance_sheet`, `get_income_statement`, `create_transaction`, `create_rule`, `create_goal`, `record_bill_payment`) within strict token budgets.
* **FR-7.3 Proactive Insights (`Insight`):** Scheduled background analyzers generating actionable cards for spending anomalies, subscription price hikes, idle cash optimization, cash-flow warnings, and net-worth milestones.

---

## 5. Non-Functional Requirements (NFR)
1. **Financial Precision:** All monetary columns in PostgreSQL MUST use `DECIMAL(19, 4)`. All backend and frontend monetary arithmetic MUST use `decimal.js` (`ROUND_HALF_EVEN`); native JS floating-point arithmetic is prohibited for money.
2. **Tenant Security:** Every API query and background job MUST enforce `familyId` scoping. Cross-tenant resource lookups MUST return `404 Not Found` to prevent ID enumeration.
3. **Privacy & AI Governance:**
   * **Privacy Mode:** Global UI toggle (`html.privacy-mode .privacy-sensitive`) that blurs all monetary amounts across screens (`filter: blur(8px)`).
   * **Explicit AI Consent:** Financial data MUST NOT be transmitted to external LLM APIs unless `family.aiEnabled` is explicitly opted in.
   * **Self-Hosted Parity & Diagnostics:** Core ledger, CSV/QIF/OFX import, budgeting, and reporting features MUST function offline/self-hosted without mandatory third-party cloud keys, exposing `/api/v1/health` and `/api/v1/version`.
4. **Performance:** Paginated transaction queries (< 150ms p95 for 50k entries per family) and pre-materialized daily `account_balances` (< 100ms p95 for 5-year net worth charts).

---

## 6. Delivery Milestones
* **Phase 1 (Weeks 1–2):** Monorepo setup, PostgreSQL + Prisma schema, Auth (Session/MFA/Passkeys), Family multi-tenancy, and Sure Design System (`packages/ui`).
* **Phase 2 (Weeks 3–4):** Polymorphic Accounts, Entries (`Transaction`, `Valuation`, `Trade`), `BalanceService` (forward/reverse calculators + daily materialization), and Transaction Drawer.
* **Phase 3 (Weeks 5–6):** CSV/QIF Import Wizard, Hierarchical Categories/Merchants/Tags, Split Transactions, Transfer Matching, and Rule Engine.
* **Phase 4 (Weeks 7–8):** Monthly Budgeting with Rollover, Financial Goals, Recurring Bills, Balance Sheet, Income Statement, and Sankey Cash Flow Chart.
* **Phase 5 (Weeks 9–11):** BullMQ + Redis worker infrastructure, `FinanceKit` conflict resolution pipeline, and priority Banking/Crypto/Market Data adapters.
* **Phase 6 (Weeks 12–14):** PDF Bank Statement LLM Extractor, Naive Bayes + LLM Auto-Categorizer, AI Chat Tool Caller, and Proactive Insight Generators.