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
      summary: 'Connect a bank/institution sync provider (SimpleFIN/Plaid/Manual)',
      tags: ['Sync'],
      requestBody: jsonRequestBody('CreateProviderConnectionSchema'),
      responses: createdJson(),
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
