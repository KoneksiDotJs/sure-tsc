# 02 — Backend Express & PostgreSQL Conventions

## 1. Thin `app.ts` & Modular Domain Layout (`apps/api/src/`)
Keep `apps/api/src/app.ts` thin (~75 lines): initialize global middleware, mount domain routers under `/api/v1/*`, and register the Swagger/OpenAPI explorer and error handler. Never add inline business routes directly in `app.ts`.

Each domain module under `apps/api/src/modules/<domain>/` owns its Express router (`*.routes.ts`), HTTP controller/validation, services, and repository:
- Route modules mounted in `app.ts`: `auth`, `family`, `accounts`, `entries`, `taxonomies`, `imports`, `rules`, `budgets`, `reports`, `sync`, `ai`, and `mcp`.
- Split complex domains into cohesive single-purpose files behind a thin facade:
  ```text
  modules/auth/
    auth.routes.ts              # Express Router
    auth.controller.ts          # HTTP request/response handling only
    auth.service.ts             # Slim facade coordinating sub-services
    auth.shared.ts              # Shared helpers, token & session builders
    auth.mfa-keys.service.ts    # TOTP MFA & scoped API keys
    auth.passkey.service.ts     # WebAuthn passkey registration/login
    auth.recovery.service.ts    # Single-use HMAC password recovery
    auth.oauth.service.ts       # Google/GitHub OAuth flows
    auth.crypto.spec.ts         # Crypto unit tests

  modules/ai/
    ai.routes.ts                # Config, chat, categorize, usage & provider routes
    ai.service.ts               # Thin orchestrator (chat + consent enforcement)
    ai.providers.ts             # Barrel re-exporting provider modules
    ai.presets.ts               # Built-in provider/model preset definitions
    ai.config.store.ts          # Runtime AI provider config persistence
    ai.client.ts                # Provider HTTP client & usage extraction
    bayes.categorizer.ts        # Local Naive Bayes entry categorizer
    ai.usage.ts                 # Cost estimation & summary aggregation
    ai.usage.tracker.ts         # Non-blocking LlmUsageEvent DB writer & query
    ai.usage.spec.ts            # Usage calculation unit tests
  ```
- Keep OpenAPI docs modular under `apps/api/src/docs/`: `sections/{types.ts,zod-mapper.ts,schemas.ts,paths.system-auth.ts,paths.ledger.ts,paths.planning-ai.ts,explorer.html.ts}` re-exported via `docs/openapi.ts`.

## 2. Standard REST API v1 Envelope
All endpoints under `/api/v1/*` return a consistent JSON structure:
```typescript
// Success (single resource)
{ "data": T }

// Success (paginated collection)
{
  "data": T[],
  "meta": {
    "page": 1,
    "perPage": 50,
    "totalCount": 420,
    "totalPages": 9
  }
}

// Error
{
  "error": {
    "code": "VALIDATION_ERROR" | "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT",
    "message": "Human-readable summary",
    "details": [{ "field": "amount", "message": "Must be a valid decimal string" }]
  }
}
```
Serialize all money values in JSON responses as fixed-scale decimal strings (e.g., `"1250.5000"`).

## 3. Middleware Pipeline Order & Auth Scoping
1. `requestIdMiddleware` — Attaches `X-Request-Id` for structured logging.
2. `authenticate` / `authenticateMiddleware` — Verifies HTTP-only session cookie or `Bearer` API key; populates `req.auth = { userId, familyId, role }`.
3. `validateBody` / `validateRequest(zodSchema)` — Validates `req.body`, `req.query`, and `req.params` using schemas from `@sure/shared`.
4. `asyncHandler(controllerFn)` — Forwards thrown `AppError` instances to `errorHandlerMiddleware`.

Always scope queries, mutations, and AI telemetry (`recordLlmUsageEvent`, `queryFamilyLlmUsage`) by `req.auth.familyId` (never trust a client-supplied `familyId`). Return `404` for cross-family resource lookups to prevent ID enumeration.

## 4. Prisma & ESM Rules
- Every repository method querying tenant entities MUST accept `familyId: string` and include it in `where` filters.
- Any `Entry` mutation MUST trigger `BalanceService` recalculation and materialize `account_balances`.
- `commitImport` evaluates active family rules before balance materialization and assigns `subMoney(parentAmount, allocatedSoFar)` to the final split child so sums match the parent exactly.
- All relative imports in `apps/api/src` must include the `.js` extension (`tsconfig.json` strict NodeNext/ESM module resolution).

## 5. Background Jobs (`BullMQ + Redis`)
Move slow or external operations off the HTTP request cycle into `apps/api/src/jobs/`:
- `sync-provider-item`: Fetches accounts/transactions from external adapters, normalizes staging conflicts, and triggers `BalanceService`.
- `apply-rules-batch`: Evaluates active `Rule` conditions against imported/synced entries.
- `process-pdf-statement`: Parses statement documents into staged import batches.
- `generate-insights`: Runs scheduled anomaly detection, subscription checks, and cash-flow summaries.
