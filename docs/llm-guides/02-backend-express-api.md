# 02 — Backend Express & PostgreSQL Conventions

## 1. Module Structure (`apps/api/src/modules/<domain>/`)
Each domain module must be self-contained:
```text
modules/transactions/
  transactions.routes.ts        # Express Router + middleware binding
  transactions.controller.ts    # HTTP request/response handling only
  transactions.service.ts       # Business rules, orchestration, BalanceService triggers
  transactions.repository.ts    # Prisma queries (always scoped by familyId)
  transactions.schema.ts        # Re-exports or extends packages/shared Zod schemas
  transactions.test.ts          # Vitest integration tests
```

## 2. Standard REST API v1 Envelope
All endpoints under `/api/v1/*` must return a consistent JSON structure:
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

## 3. Middleware Pipeline Order
1. `requestIdMiddleware` — Attaches `X-Request-Id` for structured logging.
2. `authenticateMiddleware` — Verifies HTTP-only session cookie or `Bearer` API key; populates `req.auth = { userId, familyId, role }`.
3. `validateRequest(zodSchema)` — Validates `req.body`, `req.query`, and `req.params` before reaching the controller.
4. `asyncHandler(controllerFn)` — Forwards thrown `AppError` instances to the centralized `errorHandlerMiddleware`.

## 4. Repository Tenant Scoping Rule
Every repository method MUST accept `familyId: string` as its first parameter:
```typescript
// GOOD
async findById(familyId: string, transactionId: string) {
  return prisma.entry.findFirst({
    where: {
      id: transactionId,
      account: { familyId },
    },
    include: { transaction: true },
  });
}
```

## 5. Background Jobs (`BullMQ + Redis`)
Move slow or external operations off the HTTP request cycle into `apps/api/src/jobs/`:
- `sync-provider-item`: Fetches accounts/transactions from Plaid, Wise, Coinbase, etc., normalizes through the `FinanceKit` conflict resolver, and invokes `BalanceService.materialize()`.
- `apply-rules-batch`: Evaluates active `Rule` conditions against newly imported/synced transactions.
- `process-pdf-statement`: Extracts text from uploaded PDF statements and parses entries via structured LLM output.
- `generate-insights`: Runs scheduled anomaly detection, subscription audits, and idle-cash checks.