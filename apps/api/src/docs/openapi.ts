import { ledgerPaths } from './sections/paths.ledger.js';
import { planningAiMcpPaths } from './sections/paths.planning-ai.js';
import { systemAuthFamilyPaths } from './sections/paths.system-auth.js';
import { buildComponentSchemas } from './sections/schemas.js';
import { OpenApiDocument } from './sections/types.js';

export type {
  OpenApiDocument,
  OpenApiOperationObject,
  OpenApiParameterObject,
  OpenApiSchemaObject,
} from './sections/types.js';
export { zodToOpenApi } from './sections/zod-mapper.js';
export { renderApiDocsHtml } from './sections/explorer.html.js';

export function getOpenApiSpec(): OpenApiDocument {
  return {
    openapi: '3.0.3',
    info: {
      title: 'Sure Personal Finance & Wealth API',
      version: '1.0.0',
      description:
        'Multi-tenant personal finance and wealth management REST API v1 and MCP JSON-RPC endpoint. ' +
        'All monetary amounts are serialized strictly as decimal strings (`DecimalString`), and every financial resource is scoped to the authenticated family (`req.auth.familyId`).',
      license: { name: 'AGPL-3.0 / MIT (See repository LICENSE)' },
    },
    servers: [{ url: 'http://localhost:4000', description: 'Local Express API server' }],
    tags: [
      { name: 'System', description: 'Health, version metadata, and self-hosted OpenAPI documentation' },
      { name: 'Auth', description: 'Authentication, MFA (TOTP), password management, and scoped API keys' },
      { name: 'Family', description: 'Family multi-tenant settings, member invitations, and full JSON backup export' },
      { name: 'Taxonomies', description: 'Categories, merchants, and tags' },
      { name: 'Accounts', description: 'Polymorphic accounts (Asset & Liability), loan amortization, and investment holdings' },
      { name: 'Entries', description: 'Transactions, valuations, trades, transfers, split transactions, and bulk updates' },
      { name: 'Imports', description: 'CSV/file import preview, rule evaluation on commit, and rollback revert' },
      { name: 'Rules', description: 'Deterministic automation rules (dry-run preview and execution)' },
      { name: 'Budgets & Goals', description: 'Monthly category budgets, savings/debt goals, and recurring bill series' },
      { name: 'Reports', description: 'Net worth, income statement, category rollup, and normal spending trend breakdowns' },
      { name: 'Sync', description: 'Provider connections (SimpleFIN/Plaid/Manual), sync runs, and conflict resolution' },
      { name: 'AI', description: 'Consent-gated AI insights, auto-categorization, and financial chat' },
      { name: 'MCP', description: 'Model Context Protocol JSON-RPC 2.0 endpoint for read/write financial tools' },
    ],
    security: [{ bearerAuth: [] }, { cookieAuth: [] }],
    paths: {
      ...systemAuthFamilyPaths,
      ...ledgerPaths,
      ...planningAiMcpPaths,
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT or sk_live_... API Key',
          description: 'JWT issued on login/register or a scoped API key created via POST /api/v1/auth/api-keys.',
        },
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'sure_session',
          description: 'HTTP-only session cookie set automatically on login/register.',
        },
      },
      schemas: buildComponentSchemas(),
    },
  };
}
