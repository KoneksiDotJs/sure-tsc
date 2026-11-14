# Sure (`sure-tsc`)

A TypeScript full-stack re-engineering of **[Sure](https://github.com/we-promise/sure)** (formerly Maybe Finance), a multi-tenant personal finance and wealth management platform built with React 19, Express, TypeScript, Prisma, PostgreSQL, and `decimal.js`.

---

## Architecture & Monorepo Layout

```text
sure-tsc/
├── apps/
│   ├── api/                 # Express REST API v1 (:4000), Prisma ORM, MCP JSON-RPC endpoint
│   │   ├── prisma/          # PostgreSQL schema & migrations
│   │   └── src/
│   │       ├── config/      # Env validation, logger, Prisma client, development seed
│   │       ├── middleware/  # Session / API key auth, tenant scoping, Zod request validation
│   │       └── modules/     # accounts, ai, auth, balances, budgets, entries, imports, mcp, reports, rules, sync
│   └── web/                 # React 19 + Vite + Tailwind CSS v4 SPA (:5173)
│       ├── public/          # Self-hosted Geist fonts, SVG icons, favicons & PWA assets
│       └── src/
│           ├── app/         # Three-pane navigation shell, providers, dockable AI panel
│           ├── features/    # Domain views (Dashboard, Accounts, Transactions, Budgets/Goals, Rules/Imports, Reports/Sync, Settings)
│           └── lib/         # Typed API client & TanStack Query ledger context
├── packages/
│   ├── shared/              # Zod request schemas, DTO types, Decimal(19,4) financial math & budget rollover calculators
│   └── ui/                  # Sure Design System primitives & design tokens (tokens.css)
└── docs/llm-guides/         # Architectural, backend, frontend, design-system, and testing conventions
```

---

## Key Capabilities

- **Multi-Tenant Family Ownership:** All accounts, entries, categories, rules, budgets, goals, and provider connections are scoped by `familyId`, with support for scoped API keys and MCP tool calls (`/api/v1/mcp`).
- **Polymorphic Financial Ledger:** 9 account classifications (`DEPOSITORY`, `CREDIT_CARD`, `INVESTMENT`, `CRYPTO`, `PROPERTY`, `VEHICLE`, `LOAN`, `OTHER_ASSET`, `OTHER_LIABILITY`) and 3 entry subtypes (`TRANSACTION`, `VALUATION`, `TRADE`) with `BalanceService` forward/reverse daily snapshot materialization and `LIABILITY` flow sign inversion.
- **Exact Money Math:** All money columns use PostgreSQL `DECIMAL(19, 4)` and `decimal.js` (`ROUND_HALF_EVEN`), serialized as fixed-scale decimal strings.
- **Transfers & Splits:** Atomic transfer creation (`POST /api/v1/entries/transfers`) and matching with destination-aware expense classification (`LOAN` / `INVESTMENT` contributions vs. excluded `CREDIT_CARD` / `DEPOSITORY` movements), plus split transaction leaf attribution and split-ratio remainder precision.
- **Rules & Multi-Format Importer:** Guided CSV/QIF/OFX/PDF import preview, commit (with automatic active rule execution), and revert; rule builder with dry-run preview.
- **Budgeting, Goals & Recurring Bills:** Multi-month chronological budget rollover chains, account-backed goals with day-precision pace/status (`REACHED`, `ON_TRACK`, `BEHIND`), and recurring bill tracking with calendar view and price-hike detection.
- **Reporting & Privacy:** Balance Sheet, Income Statement, **Spending vs. Normal** category comparison, D3/SVG Cash Flow Sankey diagram, global **Privacy Mode** (`Shift+P`), Light/Dark theme (`sure.tokens.json` v2.1.0), and opt-in AI chat/categorization (`family.aiEnabled`).

---

## Prerequisites

- **Node.js** `>= 20.0.0`
- **pnpm** `9.15+`
- **PostgreSQL** `16+`
- **Redis** *(optional for background queue workers)*

---

## Getting Started

1. **Install dependencies**

   ```bash
   pnpm install
   ```

2. **Configure environment variables** *(defaults for local development are provided in [env.ts](apps/api/src/config/env.ts))*

   | Variable | Default | Description |
   | :--- | :--- | :--- |
   | `PORT` | `4000` | Express API port |
   | `DATABASE_URL` | `postgresql://sure:sure_password@localhost:5432/sure_dev?schema=public` | PostgreSQL connection string |
   | `REDIS_URL` | `redis://localhost:6379` | Redis connection string |
   | `SESSION_SECRET` | *(dev fallback)* | Signing key for auth tokens |
   | `CORS_ORIGIN` | `http://localhost:5173` | Allowed frontend origin |
   | `OPENAI_API_KEY` | *(optional)* | Enables external OpenAI categorization/chat when `family.aiEnabled` is true |
   | `ANTHROPIC_API_KEY` | *(optional)* | Enables Anthropic integration when `family.aiEnabled` is true |

3. **Generate Prisma client & apply migrations**

   ```bash
   pnpm --filter @sure/api run prisma:generate
   pnpm --filter @sure/api run prisma:migrate
   ```

4. **Build shared packages & start development servers**

   ```bash
   pnpm build
   pnpm dev
   ```

   - Web SPA: `http://localhost:5173` (proxies `/api/*` to `http://localhost:4000`)
   - API v1: `http://localhost:4000/api/v1`

---

## Verification Commands

| Command | Description |
| :--- | :--- |
| `pnpm build` | Compile `@sure/shared`, `@sure/ui`, `@sure/api`, and build `@sure/web` Vite bundle |
| `pnpm typecheck` | Run strict `tsc --noEmit` across all 4 workspaces |
| `pnpm test` | Run Vitest unit specs (`@sure/shared`, `balance.spec.ts`, `rules.spec.ts`) and PostgreSQL integration tests (`entries.test.ts`) |
| `pnpm lint` | Run workspace lint checks |

---

## Related Documentation

- [PRD.md](PRD.md) — Functional and non-functional requirements
- [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md) — Color, typography, and `packages/ui` component specification
- [AGENTS.md](AGENTS.md) — Architectural invariants and coding rules
- [docs/api/README.md](docs/api/README.md) — REST API v1 & MCP documentation guide ([`docs/api/openapi.json`](docs/api/openapi.json) / live `/api/docs`)
- [docs/llm-guides/](docs/llm-guides/) — Implementation guides for domain, backend, frontend, UI, and testing
