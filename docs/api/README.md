# Sure API v1 & MCP Documentation

Sure exposes a typed **REST API v1** (`/api/v1/*`) and a **Model Context Protocol (MCP) JSON-RPC 2.0** endpoint (`/api/v1/mcp` and `/mcp`).

All request schemas documented in [`openapi.json`](openapi.json) are generated directly from the live Zod schemas used by Express middleware (`validateRequest`) in [`packages/shared`](../../packages/shared/src/index.ts) and [`apps/api`](../../apps/api/src/docs/openapi.ts).

---

## Interactive & Machine-Readable Endpoints

When the API server (`apps/api`, default port `4000`) is running:

| Endpoint | Auth Required | Purpose |
| :--- | :---: | :--- |
| `GET /api/docs` | No | Self-hosted interactive HTML API Explorer (offline-ready, no CDN dependencies) with live request testing and Bearer token persistence |
| `GET /api/v1/openapi.json` | No | Live OpenAPI `3.0.3` JSON specification (`57` paths, `38` component schemas) |
| `GET /api/v1/health` | No | Service & PostgreSQL connection health check |
| `GET /api/v1/version` | No | Release `version` and build `commit_sha` |

To regenerate the static specification file at [`docs/api/openapi.json`](openapi.json) after modifying Zod schemas or Express routes:

```powershell
pnpm --filter @sure/api run docs:generate
```

---

## Core API Conventions

### 1. Authentication & Scoped API Keys

Sure supports two authentication mechanisms across protected routes:

1. **JWT / HTTP-Only Session Cookie (`sure_session`)** — Issued automatically on `POST /api/v1/auth/register` and `POST /api/v1/auth/login` (supports TOTP MFA verification when enabled).
2. **Scoped Bearer API Keys (`Authorization: Bearer sk_live_...`)** — Created via `POST /api/v1/auth/api-keys`. The plaintext token is returned once at creation time.
   - Calling `POST /api/v1/mcp` or `POST /mcp` with an API key requires the `mcp:tools` scope.

### 2. Multi-Tenant Isolation (`familyId`)

Every authenticated financial endpoint derives ownership exclusively from `req.auth.familyId`. Client payloads cannot override `familyId` to access or mutate records belonging to another family.

### 3. Money & Decimal Serialization (`DecimalString`)

Monetary and holding quantity values are backed by PostgreSQL `DECIMAL(19, 4)` and `Decimal` arithmetic (`decimal.js`) — **never** native JS IEEE-754 floats in arithmetic or JSON strings:

- Format: `"^-?\\d+(\\.\\d{1,4})?$"` (e.g., `"1250.5000"`, `"-42.19"`)
- Currency fields accept 3-letter ISO 4217 uppercase codes (e.g., `"USD"`, `"EUR"`).

### 4. Standard JSON Envelopes

- **Success Envelope:**

```json
{
  "data": {},
  "meta": {
    "page": 1,
    "perPage": 50,
    "totalCount": 120,
    "totalPages": 3
  }
}
```

- **Error Envelope:**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [{ "field": "body.amount", "message": "Must be a valid decimal string" }]
  }
}
```

Standard error codes: `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `INTERNAL_ERROR`.

---

## Domain Resource Summary

| Tag | Base Path(s) | Capabilities |
| :--- | :--- | :--- |
| **System** | `/api/v1/health`, `/api/v1/version`, `/api/v1/openapi.json`, `/api/docs` | Liveness, release metadata, OpenAPI spec & interactive explorer |
| **Auth** | `/api/v1/auth/*` | Registration, login, logout, TOTP MFA setup/enable/disable, password change, scoped API keys |
| **Family** | `/api/v1/family/*` | Workspace settings, base currency, AI consent toggle (`aiEnabled`), member invites, JSON backup |
| **Taxonomies** | `/api/v1/taxonomies/*` | Categories (hierarchical asset/income/expense), merchants, and tags |
| **Accounts** | `/api/v1/accounts/*` | Polymorphic Asset/Liability accounts, daily balance history, loan payoff simulator, investment holdings |
| **Entries** | `/api/v1/entries/*` | `TRANSACTION`, `VALUATION`, `TRADE` entries, splits, bulk edits, transfer suggestions/matching |
| **Imports** | `/api/v1/imports/*` | Preview CSV/row batches, commit with active rule evaluation, revert committed batches |
| **Rules** | `/api/v1/rules/*` | Condition/action automation rules with dry-run preview and execution |
| **Budgets & Goals** | `/api/v1/budgets/*`, `/api/v1/goals/*`, `/api/v1/recurring/*` | Monthly category budgets (leaf-only split attribution), savings/debt goals, recurring bills |
| **Reports** | `/api/v1/reports` | Net worth, income statement, category rollups, and `spendingVsNormal` trend comparisons |
| **Sync** | `/api/v1/sync/*` | Provider connections (`SimpleFIN` / `Plaid` / `Manual`), sync execution, conflict resolution |
| **AI** | `/api/v1/ai/*` | Consent-gated (`family.aiEnabled === true`) insights, categorization, and financial chat |
| **MCP** | `/api/v1/mcp`, `/mcp` | JSON-RPC 2.0 `tools/list` and `tools/call` exposing read/write financial tools |

---

## Quick Example: Authenticate & Query Accounts

```bash
# 1. Authenticate and extract JWT token
curl -s -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@example.com","password":"password123"}'

# 2. List family accounts using Bearer JWT or sk_live_... API key
curl -s http://localhost:4000/api/v1/accounts \
  -H "Authorization: Bearer <TOKEN>"

# 3. Call MCP tools/list over JSON-RPC 2.0
curl -s -X POST http://localhost:4000/api/v1/mcp \
  -H "Authorization: Bearer <TOKEN_WITH_MCP_TOOLS_SCOPE>" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```
