import {
  createdJson,
  errorResponses,
  jsonRequestBody,
  okJson,
  OpenApiOperationObject,
  pathParam,
  ref,
} from './types.js';

export const planningAiMcpPaths: Record<string, Record<string, OpenApiOperationObject>> = {
  // Budgets, Goals & Recurring
  '/api/v1/budgets/{month}': {
    get: {
      operationId: 'getBudgetMonth',
      summary: 'Get budget allocations vs leaf-transaction actuals for a YYYY-MM month',
      tags: ['Budgets & Goals'],
      parameters: [pathParam('month', 'Month key in YYYY-MM format', 'string')],
      responses: okJson(),
    },
  },
  '/api/v1/budgets': {
    put: {
      operationId: 'upsertBudgetMonth',
      summary: 'Create or update budgeted amounts per category for a month',
      tags: ['Budgets & Goals'],
      requestBody: jsonRequestBody('UpsertBudgetMonthSchema'),
      responses: okJson(),
    },
  },
  '/api/v1/goals': {
    get: {
      operationId: 'listGoals',
      summary: 'List family savings/debt goals and account-backed progress metrics',
      tags: ['Budgets & Goals'],
      responses: okJson({ type: 'array', items: { type: 'object', additionalProperties: true } }),
    },
    post: {
      operationId: 'createGoal',
      summary: 'Create a savings or debt-payoff goal (optionally backed by accounts)',
      tags: ['Budgets & Goals'],
      requestBody: jsonRequestBody('CreateGoalSchema'),
      responses: createdJson(),
    },
  },
  '/api/v1/goals/{id}': {
    delete: {
      operationId: 'deleteGoal',
      summary: 'Delete a family goal',
      tags: ['Budgets & Goals'],
      parameters: [pathParam('id', 'Goal ID')],
      responses: { '204': { description: 'Goal deleted' }, ...errorResponses() },
    },
  },
  '/api/v1/recurring': {
    get: {
      operationId: 'listRecurring',
      summary: 'List recurring bills and income series',
      tags: ['Budgets & Goals'],
      responses: okJson({ type: 'array', items: { type: 'object', additionalProperties: true } }),
    },
    post: {
      operationId: 'createRecurring',
      summary: 'Create a recurring income or expense schedule',
      tags: ['Budgets & Goals'],
      requestBody: jsonRequestBody('CreateRecurringSchema'),
      responses: createdJson(),
    },
  },
  '/api/v1/recurring/{id}/mark-paid': {
    post: {
      operationId: 'markRecurringPaid',
      summary: 'Advance nextDueDate and record a transaction for a recurring occurrence',
      tags: ['Budgets & Goals'],
      parameters: [pathParam('id', 'Recurring ID')],
      responses: okJson(),
    },
  },
  '/api/v1/recurring/{id}': {
    delete: {
      operationId: 'deleteRecurring',
      summary: 'Delete a recurring bill/income series',
      tags: ['Budgets & Goals'],
      parameters: [pathParam('id', 'Recurring ID')],
      responses: { '204': { description: 'Recurring item deleted' }, ...errorResponses() },
    },
  },

  // Reports
  '/api/v1/reports': {
    get: {
      operationId: 'getReports',
      summary: 'Get net worth, income statement, category rollup, and spendingVsNormal trends',
      tags: ['Reports'],
      parameters: [
        { name: 'startDate', in: 'query', required: false, schema: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' } },
        { name: 'endDate', in: 'query', required: false, schema: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' } },
        { name: 'accountIds', in: 'query', required: false, description: 'Comma-separated account UUIDs', schema: { type: 'string' } },
        { name: 'interval', in: 'query', required: false, schema: { type: 'string', enum: ['daily', 'weekly', 'monthly'] } },
      ],
      responses: okJson(),
    },
  },

  // Sync
  '/api/v1/sync': {
    get: {
      operationId: 'listSyncStatus',
      summary: 'List provider connections, sync runs, and open data conflicts',
      tags: ['Sync'],
      responses: okJson(),
    },
  },
  '/api/v1/sync/conflicts/resolve': {
    post: {
      operationId: 'resolveSyncConflict',
      summary: 'Resolve a sync conflict by keeping local or remote values',
      tags: ['Sync'],
      requestBody: jsonRequestBody('ResolveFinancekitConflictSchema'),
      responses: okJson(),
    },
  },
  '/api/v1/sync/connections': {
    post: {
      operationId: 'createSyncConnection',
      summary: 'Connect and optionally configure an external sync provider (Binance/Yahoo Finance/Frankfurter FX)',
      tags: ['Sync'],
      requestBody: jsonRequestBody('CreateProviderConnectionSchema'),
      responses: createdJson(),
    },
  },
  '/api/v1/sync/connections/{id}': {
    patch: {
      operationId: 'updateSyncConnection',
      summary: 'Update provider connection label, linked account, or encrypted credentials/config',
      tags: ['Sync'],
      parameters: [pathParam('id', 'Provider connection UUID', 'uuid')],
      requestBody: jsonRequestBody('UpdateProviderConnectionSchema'),
      responses: okJson(),
    },
    delete: {
      operationId: 'deleteSyncConnection',
      summary: 'Delete a provider connection and unlink associated accounts',
      tags: ['Sync'],
      parameters: [pathParam('id', 'Provider connection UUID', 'uuid')],
      responses: okJson(),
    },
  },
  '/api/v1/sync/connections/{id}/sync': {
    post: {
      operationId: 'syncSingleConnection',
      summary: 'Run a live sync for a single provider connection',
      tags: ['Sync'],
      parameters: [pathParam('id', 'Provider connection UUID', 'uuid')],
      responses: okJson(),
    },
  },
  '/api/v1/sync/run': {
    post: {
      operationId: 'runSync',
      summary: 'Trigger a provider balance and transaction sync cycle',
      tags: ['Sync'],
      responses: okJson(),
    },
  },
  '/api/v1/sync/markets/history': {
    get: {
      operationId: 'getMarketHistory',
      summary: 'Fetch historical price series and KPI metrics for a stock, crypto ticker, or FX pair',
      tags: ['Sync'],
      parameters: [
        {
          name: 'kind',
          in: 'query',
          required: false,
          description: 'Series type: security or fx',
          schema: { type: 'string', enum: ['security', 'fx'], default: 'security' },
        },
        {
          name: 'ticker',
          in: 'query',
          required: false,
          description: 'Ticker symbol (required when kind=security, e.g. BBCA.JK, BTC-USD)',
          schema: { type: 'string' },
        },
        {
          name: 'from',
          in: 'query',
          required: false,
          description: 'Base ISO-4217 currency code (required when kind=fx)',
          schema: { type: 'string', minLength: 3, maxLength: 3 },
        },
        {
          name: 'to',
          in: 'query',
          required: false,
          description: 'Quote ISO-4217 currency code (required when kind=fx)',
          schema: { type: 'string', minLength: 3, maxLength: 3 },
        },
        {
          name: 'range',
          in: 'query',
          required: false,
          description: 'Historical range window',
          schema: { type: 'string', enum: ['5d', '1mo', '3mo', '6mo', '1y'], default: '1mo' },
        },
      ],
      responses: okJson(),
    },
  },
  '/api/v1/sync/watchlist': {
    post: {
      operationId: 'addWatchlistTicker',
      summary: 'Fetch a live market quote and register the ticker on the family watchlist',
      tags: ['Sync'],
      requestBody: jsonRequestBody('AddWatchlistTickerSchema'),
      responses: createdJson(),
    },
  },

  // AI
  '/api/v1/ai/insights': {
    get: {
      operationId: 'getAiInsights',
      summary: 'Generate consent-gated spending and net worth insights for the family',
      tags: ['AI'],
      responses: okJson(),
    },
  },
  '/api/v1/ai/categorize': {
    post: {
      operationId: 'aiCategorize',
      summary: 'Auto-suggest or apply categories to uncategorized entries (requires family.aiEnabled)',
      tags: ['AI'],
      responses: okJson(),
    },
  },
  '/api/v1/ai/chat': {
    post: {
      operationId: 'aiChat',
      summary: 'Converse with the financial AI assistant scoped to family ledger context',
      tags: ['AI'],
      requestBody: jsonRequestBody('AiChatMessageInputSchema'),
      responses: okJson(),
    },
  },
  '/api/v1/ai/usage': {
    get: {
      operationId: 'getAiLlmUsage',
      summary: 'Retrieve LLM token telemetry, recent requests, and estimated costs scoped by familyId',
      tags: ['AI'],
      parameters: [
        { name: 'startDate', in: 'query', required: false, schema: { type: 'string', format: 'date' } },
        { name: 'endDate', in: 'query', required: false, schema: { type: 'string', format: 'date' } },
        { name: 'limit', in: 'query', required: false, schema: { type: 'integer', minimum: 1, maximum: 200 } },
      ],
      responses: okJson(),
    },
  },

  // MCP
  '/api/v1/mcp': {
    post: {
      operationId: 'mcpRpcV1',
      summary: 'Execute MCP JSON-RPC 2.0 request (requires mcp:tools scope for API keys)',
      tags: ['MCP'],
      requestBody: jsonRequestBody('McpJsonRpcRequest'),
      responses: {
        '200': {
          description: 'JSON-RPC 2.0 response',
          content: { 'application/json': { schema: ref('McpJsonRpcResponse') } },
        },
        ...errorResponses(),
      },
    },
  },
  '/mcp': {
    post: {
      operationId: 'mcpRpcAlias',
      summary: 'Alias for MCP JSON-RPC 2.0 endpoint (/api/v1/mcp)',
      tags: ['MCP'],
      requestBody: jsonRequestBody('McpJsonRpcRequest'),
      responses: {
        '200': {
          description: 'JSON-RPC 2.0 response',
          content: { 'application/json': { schema: ref('McpJsonRpcResponse') } },
        },
        ...errorResponses(),
      },
    },
  },
};
