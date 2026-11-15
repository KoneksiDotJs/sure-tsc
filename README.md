# Sure (`sure-tsc`)

A TypeScript full-stack re-engineering of **[Sure](https://github.com/we-promise/sure)** (formerly Maybe Finance), a multi-tenant personal finance and wealth management platform built with React 19, Express, TypeScript, Prisma, PostgreSQL, Redis/BullMQ, and `decimal.js`.

---

## Architecture & Monorepo Layout

```text
sure-tsc/
├── .github/workflows/       # GitHub Actions CI & CD workflows (ci.yml, cd.yml)
├── apps/
│   ├── api/                 # Express REST API v1 (:4000), Prisma ORM, BullMQ workers, MCP JSON-RPC
│   │   ├── prisma/          # PostgreSQL schema, migrations & seed script
│   │   └── src/
│   │       ├── config/      # Env validation, logger, crypto, Prisma client, development seed
│   │       ├── docs/        # OpenAPI 3.0.3 generator & self-hosted /api/docs explorer
│   │       ├── middleware/  # Session / API key auth, family tenant scoping, Zod validation
│   │       └── modules/     # accounts, ai, auth, balances, budgets, entries, imports, mcp, reports, rules, sync
│   └── web/                 # React 19 + Vite + Tailwind CSS v4 SPA (:5173)
│       ├── e2e/             # Playwright end-to-end smoke suite
│       ├── public/          # Self-hosted Geist fonts, SVG icons, favicons & PWA assets
│       └── src/
│           ├── app/         # Auth shell, three-pane navigation, providers, dockable AI assistant panel
│           ├── features/    # Domain views (Dashboard, Accounts, Transactions, Budgets/Goals, Rules/Imports, Reports/Sync, Settings)
│           └── lib/         # Typed API client, i18n context, privacy mode & TanStack Query ledger context
├── packages/
│   ├── shared/              # Zod schemas, DTO types, i18n/currency configs, Decimal(19,4) math & budget calculators
│   └── ui/                  # Sure Design System primitives & design tokens (tokens.css)
├── docs/
│   ├── api/                 # Checked-in OpenAPI 3.0.3 spec (openapi.json) & API usage guide
│   └── llm-guides/          # Architectural, backend, frontend, design-system, and testing conventions
├── docker-compose.yml       # Local PostgreSQL 16 & Redis 7 services
├── turbo.json               # Turborepo task graph & globalPassThroughEnv configuration
└── .env.example             # Reference environment variables for local & CI/CD setups
```

---

## Key Capabilities

- **Multi-Tenant Family Ownership:** All accounts, entries, categories, rules, budgets, goals, and provider connections are scoped by `familyId`, with scoped API keys and MCP tool execution (`/api/v1/mcp` and `/mcp`).
- **Authentication, Passkeys & Recovery:** Email/password authentication alongside OAuth 2.0 + PKCE (Google & GitHub), WebAuthn Passkeys & Passkey MFA, and HMAC-signed password recovery tokens (with Resend email delivery or dev preview).
- **Polymorphic Financial Ledger:** 9 account classifications (`DEPOSITORY`, `CREDIT_CARD`, `INVESTMENT`, `CRYPTO`, `PROPERTY`, `VEHICLE`, `LOAN`, `OTHER_ASSET`, `OTHER_LIABILITY`) and 3 entry subtypes (`TRANSACTION`, `VALUATION`, `TRADE`) with `BalanceService` daily snapshot materialization and `LIABILITY` flow sign inversion.
- **Exact Money Math:** All monetary columns use PostgreSQL `DECIMAL(19, 4)` and `decimal.js` (`ROUND_HALF_EVEN`), serialized as fixed-scale decimal strings across the API.
- **Transfers & Splits:** Atomic transfer creation (`POST /api/v1/entries/transfers`) and matching with destination-aware expense classification (`LOAN` / `INVESTMENT` contributions vs. excluded internal movements), plus split transaction leaf attribution and split-ratio remainder precision.
- **Localization & Multi-Currency (IDR & i18n):** Full UI translations for English (`en`) and Indonesian (`id`) alongside regional formatting presets (`en`, `id`, `es`, `fr`, `de`) and family-scoped currency formatting supporting **Indonesian Rupiah (`IDR` / `Rp`)**, `USD`, `EUR`, `GBP`, `SGD`, and more.
- **Rules & Multi-Format Importer:** Guided CSV/QIF/OFX/PDF import preview, commit (with automatic active rule execution), and revert; deterministic rule builder with dry-run preview.
- **Budgeting, Goals & Recurring Bills:** Multi-month chronological budget rollover chains, account-backed goals with pace/status (`REACHED`, `ON_TRACK`, `BEHIND`), and recurring bill tracking with calendar view and price-hike detection.
- **Reporting, Privacy & AI Assistant:** Balance Sheet, Income Statement, **Spending vs. Normal** category comparison, Cash Flow Sankey diagram, global **Privacy Mode** (`Shift+P`), Light/Dark theme, and consent-gated **Sure AI Assistant** (`family.aiEnabled`) supporting **Groq**, **Google Gemini**, **OpenRouter (`:free` models)**, local **Ollama**, **OpenAI**, and **Anthropic** with live model discovery, reasoning indicators, and active model attribution.

---

## Prerequisites

- **Node.js** `>= 20.0.0` (CI runs Node `22`)
- **pnpm** `9.15.0+` (`packageManager: pnpm@9.15.0`)
- **PostgreSQL** `16+`
- **Redis** `7+` *(used by BullMQ workers and integration environment)*

---

## Getting Started

1. **Install dependencies**

   ```bash
   pnpm install
   ```

2. **Start PostgreSQL & Redis (optional via Docker Compose)**

   ```bash
   docker compose up -d
   ```

3. **Configure environment variables**

   Copy [`.env.example`](.env.example) to `.env` and adjust values as needed *(development defaults are defined in [`apps/api/src/config/env.ts`](apps/api/src/config/env.ts))*:

   | Group | Variables | Purpose |
   | :--- | :--- | :--- |
   | **Core** | `PORT`, `DATABASE_URL`, `REDIS_URL`, `SESSION_SECRET`, `CORS_ORIGIN`, `NODE_ENV` | API port (`4000`), PostgreSQL & Redis connections, session signing, frontend origin (`http://localhost:5173`) |
   | **OAuth 2.0 + PKCE** | `OAUTH_REDIRECT_BASE_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | Optional social login with Google and GitHub |
   | **WebAuthn Passkeys** | `WEBAUTHN_RP_ID`, `WEBAUTHN_RP_NAME`, `WEBAUTHN_ORIGIN` | Relying Party config for Passkey login & Passkey MFA (`localhost` in dev) |
   | **Password Recovery** | `RESEND_API_KEY`, `EMAIL_FROM` | Optional transactional email via Resend (dev mode returns a local reset preview) |
   | **AI Providers** | `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL`, `AI_BASE_URL`, `GROQ_API_KEY`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY`, `OLLAMA_BASE_URL`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` | Enables external/local LLM chat & categorization when `family.aiEnabled` is true (also configurable per family in **Settings -> AI Prompts**) |

4. **Generate Prisma client, apply migrations & optionally seed data**

   ```bash
   pnpm --filter @sure/api run prisma:generate
   pnpm --filter @sure/api run prisma:migrate
   pnpm --filter @sure/api run prisma:seed
   ```

5. **Build workspaces & start development servers**

   ```bash
   pnpm build
   pnpm dev
   ```

   - Web SPA: `http://localhost:5173` (proxies `/api/*` to `http://localhost:4000`)
   - API v1: `http://localhost:4000/api/v1`
   - Interactive API Docs: `http://localhost:4000/api/docs`

---

## Verification & Utility Commands

| Command | Description |
| :--- | :--- |
| `pnpm build` | Compile `@sure/shared`, `@sure/ui`, `@sure/api`, and build `@sure/web` Vite bundle |
| `pnpm typecheck` | Run strict `tsc --noEmit` across all 4 workspaces |
| `pnpm lint` | Run workspace lint checks across all 4 workspaces |
| `pnpm test` | Run Vitest unit specs (`@sure/shared`, `auth.crypto.spec.ts`, `balance.spec.ts`, `rules.spec.ts`, `openapi.spec.ts`) and PostgreSQL integration tests (`entries.test.ts`) |
| `pnpm --filter @sure/api run docs:generate` | Regenerate [`docs/api/openapi.json`](docs/api/openapi.json) after API route or Zod schema changes |
| `pnpm --filter @sure/web exec playwright test` | Run Playwright E2E smoke tests (`apps/web/e2e/sure.spec.ts`) |

---

## CI/CD Pipelines (GitHub Actions)

Workflows live in [`.github/workflows/`](.github/workflows):

- **[`ci.yml`](.github/workflows/ci.yml) (`CI`)** — Runs on `push` / `pull_request` to `main` and `dev` (and `workflow_dispatch`):
  - `quality`: Frozen pnpm install, Prisma generate & `prisma validate`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, and uploads compiled `dist/` build artifacts.
  - `test`: Boots `postgres:16-alpine` and `redis:7-alpine` service containers, pushes the Prisma schema, and runs `pnpm test` (runtime env vars are passed cleanly through Turborepo via `globalPassThroughEnv` in [`turbo.json`](turbo.json)).
  - `e2e` *(opt-in)*: Runs Playwright E2E tests when triggered manually with `run_e2e: true` or when repository variable `ENABLE_E2E` is `"true"`.
- **[`cd.yml`](.github/workflows/cd.yml) (`CD`)** — Runs automatically after `CI` succeeds on `main`, on `v*.*.*` tag pushes, or via `workflow_dispatch`:
  - `prepare` & `package-and-release`: Builds production bundles, packages `sure-release-<version>.tar.gz`, uploads workflow artifacts, and publishes a GitHub Release for `v*.*.*` tags.
  - `deploy`: Targets GitHub Environments (`staging` / `production`) and conditionally runs `prisma migrate deploy` (if secret `DATABASE_URL` is set), triggers a deployment webhook (if secret `DEPLOY_WEBHOOK_URL` and optional `DEPLOY_WEBHOOK_TOKEN` are set), and probes `<APP_HEALTHCHECK_URL>/api/v1/health` (if variable `APP_HEALTHCHECK_URL` is set).

---

## Related Documentation

- [PRD.md](PRD.md) — Functional and non-functional requirements
- [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md) — Color, typography, and `packages/ui` component specification
- [AGENTS.md](AGENTS.md) — Architectural invariants and coding rules
- [docs/api/README.md](docs/api/README.md) — REST API v1 & MCP documentation guide ([`docs/api/openapi.json`](docs/api/openapi.json) / live `/api/docs`)
- [docs/llm-guides/](docs/llm-guides/) — Implementation guides for domain, backend, frontend, UI, and testing
