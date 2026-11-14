import { z } from 'zod';
import {
  RegisterSchema,
  LoginSchema,
  EnableMfaSchema,
  CreateApiKeySchema,
  ChangePasswordSchema,
  UpdateFamilySettingsSchema,
  InviteFamilyMemberSchema,
  CreateCategorySchema,
  CreateMerchantSchema,
  CreateTagSchema,
  CreateAccountSchema,
  UpdateAccountSchema,
  LoanSimulationInputSchema,
  UpsertHoldingSchema,
  CreateEntrySchema,
  UpdateEntrySchema,
  SplitTransactionSchema,
  MatchTransferSchema,
  CreateTransferSchema,
  BulkEntryUpdateSchema,
  EntryFilterQuerySchema,
  CreateImportPreviewSchema,
  CommitImportSchema,
  CreateRuleSchema,
  UpdateRuleSchema,
  UpsertBudgetMonthSchema,
  CreateGoalSchema,
  CreateRecurringSchema,
  CreateProviderConnectionSchema,
  ResolveFinancekitConflictSchema,
  AiChatMessageInputSchema,
} from '@sure/shared';

export interface OpenApiSchemaObject {
  type?: string;
  format?: string;
  pattern?: string;
  enum?: Array<string | number | boolean>;
  default?: unknown;
  nullable?: boolean;
  description?: string;
  example?: unknown;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  minItems?: number;
  maxItems?: number;
  items?: OpenApiSchemaObject;
  properties?: Record<string, OpenApiSchemaObject>;
  required?: string[];
  additionalProperties?: boolean | OpenApiSchemaObject;
  oneOf?: OpenApiSchemaObject[];
  allOf?: OpenApiSchemaObject[];
  discriminator?: { propertyName: string };
  $ref?: string;
}

export interface OpenApiParameterObject {
  name: string;
  in: 'path' | 'query' | 'header';
  required: boolean;
  description?: string;
  schema: OpenApiSchemaObject;
}

export interface OpenApiOperationObject {
  operationId: string;
  summary: string;
  description?: string;
  tags: string[];
  security?: Array<Record<string, string[]>>;
  parameters?: OpenApiParameterObject[];
  requestBody?: {
    required: boolean;
    description?: string;
    content: {
      'application/json': {
        schema: OpenApiSchemaObject;
      };
    };
  };
  responses: Record<
    string,
    {
      description: string;
      content?: Record<
        string,
        {
          schema: OpenApiSchemaObject;
        }
      >;
    }
  >;
}

export interface OpenApiDocument {
  openapi: '3.0.3';
  info: {
    title: string;
    version: string;
    description: string;
    license: { name: string };
  };
  servers: Array<{ url: string; description: string }>;
  tags: Array<{ name: string; description: string }>;
  security: Array<Record<string, string[]>>;
  paths: Record<string, Record<string, OpenApiOperationObject>>;
  components: {
    securitySchemes: Record<string, Record<string, unknown>>;
    schemas: Record<string, OpenApiSchemaObject>;
  };
}

interface ZodDefLike {
  typeName?: string;
  description?: string;
  schema?: z.ZodTypeAny;
  innerType?: z.ZodTypeAny;
  type?: z.ZodTypeAny;
  in?: z.ZodTypeAny;
  out?: z.ZodTypeAny;
  defaultValue?: () => unknown;
  shape?: () => Record<string, z.ZodTypeAny>;
  checks?: Array<{ kind: string; value?: unknown; regex?: RegExp }>;
  values?: string[] | Record<string, string | number>;
  value?: string | number | boolean;
  options?: z.ZodTypeAny[];
  discriminator?: string;
  valueType?: z.ZodTypeAny;
  left?: z.ZodTypeAny;
  right?: z.ZodTypeAny;
  minLength?: { value: number } | null;
  maxLength?: { value: number } | null;
  exactLength?: { value: number } | null;
}

function getZodDef(schema: z.ZodTypeAny): ZodDefLike {
  return (schema as unknown as { _def: ZodDefLike })._def;
}

function isZodOptional(schema: z.ZodTypeAny): boolean {
  const def = getZodDef(schema);
  if (def.typeName === 'ZodOptional' || def.typeName === 'ZodDefault') {
    return true;
  }
  if (def.typeName === 'ZodEffects' && def.schema) {
    return isZodOptional(def.schema);
  }
  return false;
}

export function zodToOpenApi(schema: z.ZodTypeAny): OpenApiSchemaObject {
  const def = getZodDef(schema);
  const typeName = def.typeName;
  const description = def.description;

  const withDesc = (obj: OpenApiSchemaObject): OpenApiSchemaObject =>
    description && !obj.description ? { ...obj, description } : obj;

  switch (typeName) {
    case 'ZodEffects':
      return def.schema ? withDesc(zodToOpenApi(def.schema)) : { type: 'object' };

    case 'ZodOptional':
      return def.innerType ? withDesc(zodToOpenApi(def.innerType)) : {};

    case 'ZodNullable': {
      const inner = def.innerType ? zodToOpenApi(def.innerType) : {};
      return withDesc({ ...inner, nullable: true });
    }

    case 'ZodDefault': {
      const inner = def.innerType ? zodToOpenApi(def.innerType) : {};
      const defaultVal = typeof def.defaultValue === 'function' ? def.defaultValue() : undefined;
      return withDesc({
        ...inner,
        ...(defaultVal !== undefined ? { default: defaultVal } : {}),
      });
    }

    case 'ZodReadonly':
    case 'ZodCatch':
      return def.innerType ? withDesc(zodToOpenApi(def.innerType)) : {};

    case 'ZodPipeline':
      return def.out ? withDesc(zodToOpenApi(def.out)) : {};

    case 'ZodString': {
      const result: OpenApiSchemaObject = { type: 'string' };
      for (const check of def.checks ?? []) {
        if (check.kind === 'uuid') result.format = 'uuid';
        else if (check.kind === 'email') result.format = 'email';
        else if (check.kind === 'url') result.format = 'uri';
        else if (check.kind === 'datetime') result.format = 'date-time';
        else if (check.kind === 'min' && typeof check.value === 'number') {
          result.minLength = check.value;
        } else if (check.kind === 'max' && typeof check.value === 'number') {
          result.maxLength = check.value;
        } else if (check.kind === 'length' && typeof check.value === 'number') {
          result.minLength = check.value;
          result.maxLength = check.value;
        } else if (check.kind === 'regex' && check.regex instanceof RegExp) {
          result.pattern = check.regex.source;
        }
      }
      return withDesc(result);
    }

    case 'ZodNumber': {
      const result: OpenApiSchemaObject = { type: 'number' };
      for (const check of def.checks ?? []) {
        if (check.kind === 'int') result.type = 'integer';
        else if (check.kind === 'min' && typeof check.value === 'number') {
          result.minimum = check.value;
        } else if (check.kind === 'max' && typeof check.value === 'number') {
          result.maximum = check.value;
        }
      }
      return withDesc(result);
    }

    case 'ZodBoolean':
      return withDesc({ type: 'boolean' });

    case 'ZodDate':
      return withDesc({ type: 'string', format: 'date-time' });

    case 'ZodEnum':
      return withDesc({
        type: 'string',
        enum: Array.isArray(def.values) ? [...def.values] : [],
      });

    case 'ZodNativeEnum': {
      const vals = def.values && !Array.isArray(def.values) ? Object.values(def.values) : [];
      return withDesc({
        type: 'string',
        enum: vals.filter((v): v is string | number => typeof v === 'string' || typeof v === 'number'),
      });
    }

    case 'ZodLiteral':
      return withDesc({
        type: typeof def.value === 'number' ? 'number' : typeof def.value === 'boolean' ? 'boolean' : 'string',
        enum: def.value !== undefined ? [def.value] : [],
      });

    case 'ZodArray': {
      const result: OpenApiSchemaObject = {
        type: 'array',
        items: def.type ? zodToOpenApi(def.type) : {},
      };
      if (def.minLength) result.minItems = def.minLength.value;
      if (def.maxLength) result.maxItems = def.maxLength.value;
      if (def.exactLength) {
        result.minItems = def.exactLength.value;
        result.maxItems = def.exactLength.value;
      }
      return withDesc(result);
    }

    case 'ZodObject': {
      const shape = typeof def.shape === 'function' ? def.shape() : {};
      const properties: Record<string, OpenApiSchemaObject> = {};
      const required: string[] = [];

      for (const [key, fieldSchema] of Object.entries(shape)) {
        properties[key] = zodToOpenApi(fieldSchema);
        if (!isZodOptional(fieldSchema)) {
          required.push(key);
        }
      }

      return withDesc({
        type: 'object',
        properties,
        ...(required.length > 0 ? { required } : {}),
      });
    }

    case 'ZodRecord':
      return withDesc({
        type: 'object',
        additionalProperties: def.valueType ? zodToOpenApi(def.valueType) : true,
      });

    case 'ZodUnion':
      return withDesc({
        oneOf: (def.options ?? []).map((opt) => zodToOpenApi(opt)),
      });

    case 'ZodDiscriminatedUnion':
      return withDesc({
        oneOf: (def.options ?? []).map((opt) => zodToOpenApi(opt)),
        ...(def.discriminator ? { discriminator: { propertyName: def.discriminator } } : {}),
      });

    case 'ZodIntersection':
      return withDesc({
        allOf: [
          ...(def.left ? [zodToOpenApi(def.left)] : []),
          ...(def.right ? [zodToOpenApi(def.right)] : []),
        ],
      });

    case 'ZodAny':
    case 'ZodUnknown':
    default:
      return withDesc({ type: 'object', additionalProperties: true });
  }
}

function queryParamsFromZodObject(schema: z.ZodObject<z.ZodRawShape>): OpenApiParameterObject[] {
  const shape = schema.shape;
  return Object.entries(shape).map(([name, fieldSchema]) => ({
    name,
    in: 'query',
    required: !isZodOptional(fieldSchema),
    schema: zodToOpenApi(fieldSchema),
  }));
}

const schemaRegistry = {
  RegisterSchema,
  LoginSchema,
  EnableMfaSchema,
  CreateApiKeySchema,
  ChangePasswordSchema,
  UpdateFamilySettingsSchema,
  InviteFamilyMemberSchema,
  CreateCategorySchema,
  CreateMerchantSchema,
  CreateTagSchema,
  CreateAccountSchema,
  UpdateAccountSchema,
  LoanSimulationInputSchema,
  UpsertHoldingSchema,
  CreateEntrySchema,
  UpdateEntrySchema,
  SplitTransactionSchema,
  MatchTransferSchema,
  CreateTransferSchema,
  BulkEntryUpdateSchema,
  EntryFilterQuerySchema,
  CreateImportPreviewSchema,
  CommitImportSchema,
  CreateRuleSchema,
  UpdateRuleSchema,
  UpsertBudgetMonthSchema,
  CreateGoalSchema,
  CreateRecurringSchema,
  CreateProviderConnectionSchema,
  ResolveFinancekitConflictSchema,
  AiChatMessageInputSchema,
} as const;

function ref(schemaName: string): OpenApiSchemaObject {
  return { $ref: `#/components/schemas/${schemaName}` };
}

function dataEnvelope(dataSchema: OpenApiSchemaObject, withMeta = false): OpenApiSchemaObject {
  return {
    type: 'object',
    properties: {
      data: dataSchema,
      ...(withMeta ? { meta: ref('PaginationMeta') } : {}),
    },
    required: ['data'],
  };
}

function errorResponses(): Record<string, { description: string; content: { 'application/json': { schema: OpenApiSchemaObject } } }> {
  return {
    '400': {
      description: 'Validation or domain rule error',
      content: { 'application/json': { schema: ref('ApiErrorResponse') } },
    },
    '401': {
      description: 'Missing or invalid JWT / session cookie / API key',
      content: { 'application/json': { schema: ref('ApiErrorResponse') } },
    },
    '404': {
      description: 'Resource not found in the authenticated family',
      content: { 'application/json': { schema: ref('ApiErrorResponse') } },
    },
  };
}

function jsonRequestBody(schemaName: string, description?: string): OpenApiOperationObject['requestBody'] {
  return {
    required: true,
    ...(description ? { description } : {}),
    content: {
      'application/json': {
        schema: ref(schemaName),
      },
    },
  };
}

function pathParam(name: string, description: string, format: 'uuid' | 'string' = 'uuid'): OpenApiParameterObject {
  return {
    name,
    in: 'path',
    required: true,
    description,
    schema: format === 'uuid' ? { type: 'string', format: 'uuid' } : { type: 'string' },
  };
}

export function getOpenApiSpec(): OpenApiDocument {
  const generatedSchemas: Record<string, OpenApiSchemaObject> = {};
  for (const [name, zodSchema] of Object.entries(schemaRegistry)) {
    generatedSchemas[name] = zodToOpenApi(zodSchema);
  }

  const componentsSchemas: Record<string, OpenApiSchemaObject> = {
    DecimalString: {
      type: 'string',
      pattern: '^-?\\d+(\\.\\d{1,4})?$',
      example: '1250.5000',
      description: 'Decimal(19, 4) money/quantity amount serialized strictly as a string (never float).',
    },
    ApiErrorResponse: {
      type: 'object',
      required: ['error'],
      properties: {
        error: {
          type: 'object',
          required: ['code', 'message'],
          properties: {
            code: {
              type: 'string',
              enum: ['VALIDATION_ERROR', 'UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND', 'CONFLICT', 'INTERNAL_ERROR'],
            },
            message: { type: 'string' },
            details: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: { type: 'string' },
                  message: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    PaginationMeta: {
      type: 'object',
      required: ['page', 'perPage', 'totalCount', 'totalPages'],
      properties: {
        page: { type: 'integer', example: 1 },
        perPage: { type: 'integer', example: 50 },
        totalCount: { type: 'integer', example: 120 },
        totalPages: { type: 'integer', example: 3 },
      },
    },
    HealthStatus: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        database: { type: 'string', example: 'connected' },
        service: { type: 'string', example: 'sure-api' },
        version: { type: 'string', example: '1.0.0' },
      },
    },
    VersionInfo: {
      type: 'object',
      properties: {
        version: { type: 'string', example: '1.0.0' },
        commit_sha: { type: 'string', example: 'local-dev' },
      },
    },
    McpJsonRpcRequest: {
      type: 'object',
      required: ['jsonrpc', 'method'],
      properties: {
        jsonrpc: { type: 'string', enum: ['2.0'] },
        id: { oneOf: [{ type: 'string' }, { type: 'integer' }] },
        method: { type: 'string', enum: ['tools/list', 'tools/call'], example: 'tools/list' },
        params: {
          type: 'object',
          properties: {
            name: { type: 'string', example: 'get_accounts' },
            arguments: { type: 'object', additionalProperties: true },
          },
        },
      },
    },
    McpJsonRpcResponse: {
      type: 'object',
      required: ['jsonrpc'],
      properties: {
        jsonrpc: { type: 'string', enum: ['2.0'] },
        id: { oneOf: [{ type: 'string' }, { type: 'integer' }, { type: 'object', nullable: true }] },
        result: { type: 'object', additionalProperties: true },
        error: {
          type: 'object',
          properties: {
            code: { type: 'integer' },
            message: { type: 'string' },
          },
        },
      },
    },
    ...generatedSchemas,
  };

  const okJson = (dataSchema: OpenApiSchemaObject = { type: 'object', additionalProperties: true }, withMeta = false) => ({
    '200': {
      description: 'Successful response',
      content: { 'application/json': { schema: dataEnvelope(dataSchema, withMeta) } },
    },
    ...errorResponses(),
  });

  const createdJson = (dataSchema: OpenApiSchemaObject = { type: 'object', additionalProperties: true }) => ({
    '201': {
      description: 'Resource created',
      content: { 'application/json': { schema: dataEnvelope(dataSchema) } },
    },
    ...errorResponses(),
  });

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
    servers: [
      { url: 'http://localhost:4000', description: 'Local Express API server' },
    ],
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
      '/api/v1/health': {
        get: {
          operationId: 'getHealth',
          summary: 'API & database health check',
          tags: ['System'],
          security: [],
          responses: {
            '200': {
              description: 'Service healthy',
              content: { 'application/json': { schema: dataEnvelope(ref('HealthStatus')) } },
            },
            '503': {
              description: 'Database unavailable',
              content: { 'application/json': { schema: ref('ApiErrorResponse') } },
            },
          },
        },
      },
      '/api/v1/version': {
        get: {
          operationId: 'getVersion',
          summary: 'Release version and build commit SHA',
          tags: ['System'],
          security: [],
          responses: {
            '200': {
              description: 'Version metadata',
              content: { 'application/json': { schema: dataEnvelope(ref('VersionInfo')) } },
            },
          },
        },
      },
      '/api/v1/openapi.json': {
        get: {
          operationId: 'getOpenApiSpec',
          summary: 'OpenAPI 3.0.3 JSON specification',
          tags: ['System'],
          security: [],
          responses: {
            '200': {
              description: 'OpenAPI 3.0.3 specification document',
              content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } },
            },
          },
        },
      },
      '/api/docs': {
        get: {
          operationId: 'getApiDocsUi',
          summary: 'Interactive self-hosted API Explorer',
          tags: ['System'],
          security: [],
          responses: {
            '200': {
              description: 'HTML API Explorer UI',
              content: { 'text/html': { schema: { type: 'string' } } },
            },
          },
        },
      },

      // Auth
      '/api/v1/auth/register': {
        post: {
          operationId: 'registerUser',
          summary: 'Register user and create initial family workspace',
          tags: ['Auth'],
          security: [],
          requestBody: jsonRequestBody('RegisterSchema'),
          responses: createdJson(),
        },
      },
      '/api/v1/auth/login': {
        post: {
          operationId: 'loginUser',
          summary: 'Authenticate with email/password (+ optional TOTP code)',
          tags: ['Auth'],
          security: [],
          requestBody: jsonRequestBody('LoginSchema'),
          responses: okJson(),
        },
      },
      '/api/v1/auth/logout': {
        post: {
          operationId: 'logoutUser',
          summary: 'Clear active authentication cookie',
          tags: ['Auth'],
          security: [],
          responses: okJson(),
        },
      },
      '/api/v1/auth/me': {
        get: {
          operationId: 'getCurrentUser',
          summary: 'Get authenticated user and active family session',
          tags: ['Auth'],
          responses: okJson(),
        },
      },
      '/api/v1/auth/mfa/setup': {
        post: {
          operationId: 'setupMfa',
          summary: 'Generate a new TOTP secret and otpauth QR URI',
          tags: ['Auth'],
          responses: okJson(),
        },
      },
      '/api/v1/auth/mfa/enable': {
        post: {
          operationId: 'enableMfa',
          summary: 'Verify TOTP token and enable MFA on user account',
          tags: ['Auth'],
          requestBody: jsonRequestBody('EnableMfaSchema'),
          responses: okJson(),
        },
      },
      '/api/v1/auth/mfa/disable': {
        post: {
          operationId: 'disableMfa',
          summary: 'Disable TOTP MFA for current user',
          tags: ['Auth'],
          responses: okJson(),
        },
      },
      '/api/v1/auth/api-keys': {
        get: {
          operationId: 'listApiKeys',
          summary: 'List API keys created for current user',
          tags: ['Auth'],
          responses: okJson({ type: 'array', items: { type: 'object', additionalProperties: true } }),
        },
        post: {
          operationId: 'createApiKey',
          summary: 'Create a scoped Bearer API key (plaintext returned once)',
          tags: ['Auth'],
          requestBody: jsonRequestBody('CreateApiKeySchema'),
          responses: createdJson(),
        },
      },
      '/api/v1/auth/api-keys/{id}': {
        delete: {
          operationId: 'revokeApiKey',
          summary: 'Revoke an existing API key',
          tags: ['Auth'],
          parameters: [pathParam('id', 'API Key ID')],
          responses: { '204': { description: 'Revoked' }, ...errorResponses() },
        },
      },
      '/api/v1/auth/password': {
        patch: {
          operationId: 'changePassword',
          summary: 'Change current user password',
          tags: ['Auth'],
          requestBody: jsonRequestBody('ChangePasswordSchema'),
          responses: okJson(),
        },
      },

      // Family
      '/api/v1/family': {
        get: {
          operationId: 'getFamily',
          summary: 'Get active family details and member list',
          tags: ['Family'],
          responses: okJson(),
        },
        patch: {
          operationId: 'updateFamily',
          summary: 'Update family name, base currency, AI consent, and locale preferences',
          tags: ['Family'],
          requestBody: jsonRequestBody('UpdateFamilySettingsSchema'),
          responses: okJson(),
        },
      },
      '/api/v1/family/members': {
        post: {
          operationId: 'inviteFamilyMember',
          summary: 'Create or attach a family member account',
          tags: ['Family'],
          requestBody: jsonRequestBody('InviteFamilyMemberSchema'),
          responses: createdJson(),
        },
      },
      '/api/v1/family/backup': {
        get: {
          operationId: 'exportFamilyBackup',
          summary: 'Download full family JSON backup bundle',
          tags: ['Family'],
          responses: okJson(),
        },
      },

      // Taxonomies
      '/api/v1/taxonomies': {
        get: {
          operationId: 'listTaxonomies',
          summary: 'List all categories, merchants, and tags for the family',
          tags: ['Taxonomies'],
          responses: okJson(),
        },
      },
      '/api/v1/taxonomies/categories': {
        post: {
          operationId: 'createCategory',
          summary: 'Create a transaction category (supports hierarchy & classification)',
          tags: ['Taxonomies'],
          requestBody: jsonRequestBody('CreateCategorySchema'),
          responses: createdJson(),
        },
      },
      '/api/v1/taxonomies/merchants': {
        post: {
          operationId: 'createMerchant',
          summary: 'Create a merchant record',
          tags: ['Taxonomies'],
          requestBody: jsonRequestBody('CreateMerchantSchema'),
          responses: createdJson(),
        },
      },
      '/api/v1/taxonomies/tags': {
        post: {
          operationId: 'createTag',
          summary: 'Create a ledger tag',
          tags: ['Taxonomies'],
          requestBody: jsonRequestBody('CreateTagSchema'),
          responses: createdJson(),
        },
      },

      // Accounts
      '/api/v1/accounts': {
        get: {
          operationId: 'listAccounts',
          summary: 'List all family accounts with serialized balances and net worth breakdown',
          tags: ['Accounts'],
          responses: okJson({ type: 'array', items: { type: 'object', additionalProperties: true } }),
        },
        post: {
          operationId: 'createAccount',
          summary: 'Create a new ASSET or LIABILITY account with initial balance snapshot',
          tags: ['Accounts'],
          requestBody: jsonRequestBody('CreateAccountSchema'),
          responses: createdJson(),
        },
      },
      '/api/v1/accounts/{id}': {
        get: {
          operationId: 'getAccount',
          summary: 'Get a single account detail view with balance series',
          tags: ['Accounts'],
          parameters: [pathParam('id', 'Account ID')],
          responses: okJson(),
        },
        patch: {
          operationId: 'updateAccount',
          summary: 'Update account attributes or active/goal status',
          tags: ['Accounts'],
          parameters: [pathParam('id', 'Account ID')],
          requestBody: jsonRequestBody('UpdateAccountSchema'),
          responses: okJson(),
        },
        delete: {
          operationId: 'deleteAccount',
          summary: 'Delete an account owned by the family',
          tags: ['Accounts'],
          parameters: [pathParam('id', 'Account ID')],
          responses: { '204': { description: 'Account deleted' }, ...errorResponses() },
        },
      },
      '/api/v1/accounts/{id}/loan-simulation': {
        post: {
          operationId: 'simulateLoanPayoff',
          summary: 'Calculate monthly amortization schedule and extra-payment interest savings',
          tags: ['Accounts'],
          parameters: [pathParam('id', 'Loan account ID')],
          requestBody: jsonRequestBody('LoanSimulationInputSchema'),
          responses: okJson(),
        },
      },
      '/api/v1/accounts/{id}/holdings': {
        get: {
          operationId: 'listAccountHoldings',
          summary: 'List investment/crypto holdings and portfolio weightings for an account',
          tags: ['Accounts'],
          parameters: [pathParam('id', 'Investment/Crypto account ID')],
          responses: okJson({ type: 'array', items: { type: 'object', additionalProperties: true } }),
        },
        post: {
          operationId: 'upsertAccountHolding',
          summary: 'Create or update a security holding position inside an account',
          tags: ['Accounts'],
          parameters: [pathParam('id', 'Investment/Crypto account ID')],
          requestBody: jsonRequestBody('UpsertHoldingSchema'),
          responses: okJson(),
        },
      },

      // Entries
      '/api/v1/entries': {
        get: {
          operationId: 'listEntries',
          summary: 'List paginated ledger entries with filtering and summary metrics',
          tags: ['Entries'],
          parameters: queryParamsFromZodObject(EntryFilterQuerySchema),
          responses: okJson({ type: 'array', items: { type: 'object', additionalProperties: true } }, true),
        },
        post: {
          operationId: 'createEntry',
          summary: 'Create a TRANSACTION, VALUATION, or TRADE entry and recalculate balances',
          tags: ['Entries'],
          requestBody: jsonRequestBody('CreateEntrySchema'),
          responses: createdJson(),
        },
      },
      '/api/v1/entries/bulk': {
        post: {
          operationId: 'bulkUpdateEntries',
          summary: 'Bulk update category, merchant, date, tags, exclusion, or delete selected entries',
          tags: ['Entries'],
          requestBody: jsonRequestBody('BulkEntryUpdateSchema'),
          responses: okJson(),
        },
      },
      '/api/v1/entries/transfers/suggestions': {
        get: {
          operationId: 'getTransferSuggestions',
          summary: 'Detect candidate cross-account transfer pairs by date window & amount',
          tags: ['Entries'],
          responses: okJson({ type: 'array', items: { type: 'object', additionalProperties: true } }),
        },
      },
      '/api/v1/entries/transfers/match': {
        post: {
          operationId: 'matchTransfer',
          summary: 'Pair two existing entries into a destination-aware Transfer',
          tags: ['Entries'],
          requestBody: jsonRequestBody('MatchTransferSchema'),
          responses: okJson(),
        },
      },
      '/api/v1/entries/transfers': {
        post: {
          operationId: 'createTransfer',
          summary: 'Create an atomic two-legged transfer between two family accounts',
          tags: ['Entries'],
          requestBody: jsonRequestBody('CreateTransferSchema'),
          responses: createdJson(),
        },
      },
      '/api/v1/entries/{id}': {
        get: {
          operationId: 'getEntry',
          summary: 'Get full ledger entry details including split children or transfer link',
          tags: ['Entries'],
          parameters: [pathParam('id', 'Entry ID')],
          responses: okJson(),
        },
        patch: {
          operationId: 'updateEntry',
          summary: 'Update an entry and trigger daily balance recalculation',
          tags: ['Entries'],
          parameters: [pathParam('id', 'Entry ID')],
          requestBody: jsonRequestBody('UpdateEntrySchema'),
          responses: okJson(),
        },
        delete: {
          operationId: 'deleteEntry',
          summary: 'Delete an entry (releases paired transfer exclusion if applicable)',
          tags: ['Entries'],
          parameters: [pathParam('id', 'Entry ID')],
          responses: { '204': { description: 'Entry deleted' }, ...errorResponses() },
        },
      },
      '/api/v1/entries/{id}/split': {
        post: {
          operationId: 'splitTransaction',
          summary: 'Split a transaction into child entries whose amounts must equal parent sum',
          tags: ['Entries'],
          parameters: [pathParam('id', 'Parent transaction Entry ID')],
          requestBody: jsonRequestBody('SplitTransactionSchema'),
          responses: okJson(),
        },
      },

      // Imports
      '/api/v1/imports': {
        get: {
          operationId: 'listImports',
          summary: 'List import batches and statuses for the family',
          tags: ['Imports'],
          responses: okJson({ type: 'array', items: { type: 'object', additionalProperties: true } }),
        },
      },
      '/api/v1/imports/preview': {
        post: {
          operationId: 'previewImport',
          summary: 'Parse CSV/row payload into a preview import batch',
          tags: ['Imports'],
          requestBody: jsonRequestBody('CreateImportPreviewSchema'),
          responses: createdJson(),
        },
      },
      '/api/v1/imports/commit': {
        post: {
          operationId: 'commitImport',
          summary: 'Commit previewed rows, execute active rules, and materialize account balances',
          tags: ['Imports'],
          requestBody: jsonRequestBody('CommitImportSchema'),
          responses: okJson(),
        },
      },
      '/api/v1/imports/{id}/revert': {
        post: {
          operationId: 'revertImport',
          summary: 'Revert a committed import batch and recalculate affected accounts',
          tags: ['Imports'],
          parameters: [pathParam('id', 'Import Batch ID')],
          responses: okJson(),
        },
      },

      // Rules
      '/api/v1/rules': {
        get: {
          operationId: 'listRules',
          summary: 'List all automation rules configured by the family',
          tags: ['Rules'],
          responses: okJson({ type: 'array', items: { type: 'object', additionalProperties: true } }),
        },
        post: {
          operationId: 'createRule',
          summary: 'Create a rule with match conditions and actions (category, tags, splits, exclude)',
          tags: ['Rules'],
          requestBody: jsonRequestBody('CreateRuleSchema'),
          responses: createdJson(),
        },
      },
      '/api/v1/rules/{id}': {
        patch: {
          operationId: 'updateRule',
          summary: 'Update an existing rule definition or active toggle',
          tags: ['Rules'],
          parameters: [pathParam('id', 'Rule ID')],
          requestBody: jsonRequestBody('UpdateRuleSchema'),
          responses: okJson(),
        },
        delete: {
          operationId: 'deleteRule',
          summary: 'Delete an automation rule',
          tags: ['Rules'],
          parameters: [pathParam('id', 'Rule ID')],
          responses: { '204': { description: 'Rule deleted' }, ...errorResponses() },
        },
      },
      '/api/v1/rules/dry-run': {
        post: {
          operationId: 'dryRunRule',
          summary: 'Preview which existing entries would match a rule without mutating data',
          tags: ['Rules'],
          requestBody: jsonRequestBody('CreateRuleSchema'),
          responses: okJson(),
        },
      },
      '/api/v1/rules/execute': {
        post: {
          operationId: 'executeRules',
          summary: 'Execute all active rules across existing unsplit entries',
          tags: ['Rules'],
          responses: okJson(),
        },
      },

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
      schemas: componentsSchemas,
    },
  };
}

export function renderApiDocsHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Sure API Explorer (OpenAPI 3.0.3)</title>
  <style>
    :root {
      --bg: #fafafa;
      --surface: #ffffff;
      --surface-alt: #f5f5f5;
      --border: #e5e5e5;
      --text: #171717;
      --muted: #737373;
      --accent: #09090b;
      --get: #15803d;
      --post: #1d4ed8;
      --patch: #b45309;
      --put: #6d28d9;
      --delete: #b91c1c;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.5;
    }
    header {
      background: var(--surface);
      border-bottom: 1px solid var(--border);
      padding: 20px 24px;
      position: sticky;
      top: 0;
      z-index: 10;
    }
    .header-inner {
      max-width: 1120px;
      margin: 0 auto;
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      align-items: center;
      justify-content: space-between;
    }
    .title h1 { margin: 0; font-size: 20px; font-weight: 600; }
    .title p { margin: 2px 0 0; font-size: 13px; color: var(--muted); }
    .controls { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
    input[type="text"], input[type="password"] {
      border: 1px solid var(--border);
      background: var(--surface);
      padding: 8px 12px;
      border-radius: 8px;
      font-size: 13px;
      min-width: 220px;
    }
    button {
      border: 1px solid var(--border);
      background: var(--accent);
      color: #fff;
      padding: 8px 14px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
    }
    button.secondary {
      background: var(--surface);
      color: var(--text);
    }
    main { max-width: 1120px; margin: 24px auto; padding: 0 24px 64px; }
    .tags { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px; }
    .tag-btn {
      background: var(--surface);
      color: var(--text);
      border: 1px solid var(--border);
      padding: 5px 12px;
      border-radius: 999px;
      font-size: 12px;
    }
    .tag-btn.active { background: var(--accent); color: #fff; border-color: var(--accent); }
    .op-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 10px;
      margin-bottom: 10px;
      overflow: hidden;
    }
    .op-header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      cursor: pointer;
    }
    .method {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      padding: 3px 8px;
      border-radius: 6px;
      color: #fff;
      min-width: 64px;
      text-align: center;
    }
    .method.get { background: var(--get); }
    .method.post { background: var(--post); }
    .method.patch { background: var(--patch); }
    .method.put { background: var(--put); }
    .method.delete { background: var(--delete); }
    .op-path { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px; font-weight: 600; }
    .op-summary { font-size: 13px; color: var(--muted); margin-left: auto; }
    .op-body {
      border-top: 1px solid var(--border);
      background: var(--surface-alt);
      padding: 16px;
      display: none;
    }
    .op-body.open { display: block; }
    pre, textarea {
      width: 100%;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 12px;
      background: #111827;
      color: #f9fafb;
      padding: 12px;
      border-radius: 8px;
      border: 1px solid #374151;
      overflow-x: auto;
    }
    textarea { min-height: 120px; resize: vertical; }
    .section-label { font-size: 12px; font-weight: 600; color: var(--muted); text-transform: uppercase; margin: 12px 0 6px; }
    .param-row { display: flex; gap: 8px; align-items: center; margin-bottom: 6px; font-size: 13px; }
    .param-row label { min-width: 160px; font-family: ui-monospace, monospace; font-size: 12px; }
  </style>
</head>
<body>
  <header>
    <div class="header-inner">
      <div class="title">
        <h1>Sure REST &amp; MCP API Explorer</h1>
        <p id="spec-meta">Loading OpenAPI 3.0.3 specification...</p>
      </div>
      <div class="controls">
        <input id="search-input" type="text" placeholder="Filter by path or summary..." />
        <input id="token-input" type="password" placeholder="Bearer JWT or sk_live_... key" />
        <button id="save-token-btn" class="secondary" type="button">Use Token</button>
        <a href="/api/v1/openapi.json" target="_blank"><button class="secondary" type="button">openapi.json</button></a>
      </div>
    </div>
  </header>
  <main>
    <div id="tags" class="tags"></div>
    <div id="operations"></div>
  </main>
  <script>
    (function () {
      let spec = null;
      let activeTag = 'ALL';
      let token = sessionStorage.getItem('sure_docs_token') || '';
      const tokenInput = document.getElementById('token-input');
      const searchInput = document.getElementById('search-input');
      tokenInput.value = token;

      document.getElementById('save-token-btn').addEventListener('click', function () {
        token = tokenInput.value.trim();
        sessionStorage.setItem('sure_docs_token', token);
      });

      function resolveSchema(schema, depth) {
        if (!schema || depth > 5) return schema || {};
        if (schema.$ref && spec && spec.components && spec.components.schemas) {
          const name = schema.$ref.replace('#/components/schemas/', '');
          return resolveSchema(spec.components.schemas[name], depth + 1);
        }
        return schema;
      }

      function sampleFromSchema(schema, depth) {
        const s = resolveSchema(schema, depth || 0);
        if (!s) return {};
        if (s.default !== undefined) return s.default;
        if (s.enum && s.enum.length) return s.enum[0];
        if (s.example !== undefined) return s.example;
        if (s.oneOf && s.oneOf.length) return sampleFromSchema(s.oneOf[0], (depth || 0) + 1);
        if (s.type === 'object' && s.properties) {
          const out = {};
          for (const [k, v] of Object.entries(s.properties)) {
            out[k] = sampleFromSchema(v, (depth || 0) + 1);
          }
          return out;
        }
        if (s.type === 'array') return [sampleFromSchema(s.items, (depth || 0) + 1)];
        if (s.type === 'boolean') return false;
        if (s.type === 'integer' || s.type === 'number') return 1;
        if (s.format === 'uuid') return '00000000-0000-0000-0000-000000000000';
        if (s.format === 'email') return 'user@example.com';
        return 'string';
      }

      function render() {
        if (!spec) return;
        const query = searchInput.value.trim().toLowerCase();
        const opsEl = document.getElementById('operations');
        opsEl.innerHTML = '';

        for (const [pathKey, methods] of Object.entries(spec.paths)) {
          for (const [method, op] of Object.entries(methods)) {
            const tags = op.tags || ['General'];
            if (activeTag !== 'ALL' && !tags.includes(activeTag)) continue;
            const hay = (method + ' ' + pathKey + ' ' + (op.summary || '')).toLowerCase();
            if (query && !hay.includes(query)) continue;

            const card = document.createElement('div');
            card.className = 'op-card';
            const header = document.createElement('div');
            header.className = 'op-header';
            header.innerHTML =
              '<span class="method ' + method + '">' + method + '</span>' +
              '<span class="op-path">' + pathKey + '</span>' +
              '<span class="op-summary">' + (op.summary || '') + '</span>';

            const body = document.createElement('div');
            body.className = 'op-body';

            const paramsHtml = (op.parameters || [])
              .map(function (p) {
                return '<div class="param-row"><label>' + p.name + ' (' + p.in + (p.required ? '*' : '') + ')</label>' +
                  '<input data-param-in="' + p.in + '" data-param-name="' + p.name + '" type="text" placeholder="' + (p.description || p.schema.type || '') + '" /></div>';
              })
              .join('');

            const reqSchema = op.requestBody && op.requestBody.content && op.requestBody.content['application/json']
              ? op.requestBody.content['application/json'].schema
              : null;

            const reqSample = reqSchema ? JSON.stringify(sampleFromSchema(reqSchema, 0), null, 2) : '';

            body.innerHTML =
              (op.description ? '<p>' + op.description + '</p>' : '') +
              (paramsHtml ? '<div class="section-label">Parameters</div>' + paramsHtml : '') +
              (reqSchema
                ? '<div class="section-label">Request Body (application/json)</div>' +
                  '<textarea class="req-body">' + reqSample + '</textarea>' +
                  '<div class="section-label">Schema</div><pre>' + JSON.stringify(resolveSchema(reqSchema, 0), null, 2) + '</pre>'
                : '') +
              '<div style="margin-top:12px;"><button type="button" class="send-btn">Send Request</button></div>' +
              '<div class="resp-wrap" style="display:none;"><div class="section-label resp-status"></div><pre class="resp-pre"></pre></div>';

            header.addEventListener('click', function () {
              body.classList.toggle('open');
            });

            body.querySelector('.send-btn').addEventListener('click', async function () {
              let targetUrl = pathKey;
              const qp = new URLSearchParams();
              body.querySelectorAll('input[data-param-name]').forEach(function (inp) {
                const val = inp.value.trim();
                const name = inp.getAttribute('data-param-name');
                if (inp.getAttribute('data-param-in') === 'path') {
                  targetUrl = targetUrl.replace('{' + name + '}', encodeURIComponent(val || '00000000-0000-0000-0000-000000000000'));
                } else if (val) {
                  qp.set(name, val);
                }
              });
              const qs = qp.toString();
              if (qs) targetUrl += '?' + qs;

              const headers = {};
              const activeToken = tokenInput.value.trim();
              if (activeToken) headers['Authorization'] = 'Bearer ' + activeToken;
              const init = { method: method.toUpperCase(), credentials: 'include', headers };
              const ta = body.querySelector('.req-body');
              if (ta && ['POST', 'PATCH', 'PUT'].includes(method.toUpperCase())) {
                headers['Content-Type'] = 'application/json';
                init.body = ta.value;
              }
              const started = performance.now();
              const res = await fetch(targetUrl, init);
              const elapsed = Math.round(performance.now() - started);
              const text = await res.text();
              let pretty = text;
              try { pretty = JSON.stringify(JSON.parse(text), null, 2); } catch (_) {}
              const wrap = body.querySelector('.resp-wrap');
              wrap.style.display = 'block';
              body.querySelector('.resp-status').textContent = 'Response: HTTP ' + res.status + ' (' + elapsed + ' ms)';
              body.querySelector('.resp-pre').textContent = pretty;
            });

            card.appendChild(header);
            card.appendChild(body);
            opsEl.appendChild(card);
          }
        }
      }

      fetch('/api/v1/openapi.json')
        .then(function (r) { return r.json(); })
        .then(function (data) {
          spec = data;
          document.getElementById('spec-meta').textContent =
            'OpenAPI ' + data.openapi + ' • ' + data.info.title + ' v' + data.info.version +
            ' • ' + Object.keys(data.paths).length + ' paths';
          const tagsEl = document.getElementById('tags');
          const tagNames = ['ALL'].concat((data.tags || []).map(function (t) { return t.name; }));
          tagNames.forEach(function (tag) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'tag-btn' + (tag === activeTag ? ' active' : '');
            btn.textContent = tag;
            btn.addEventListener('click', function () {
              activeTag = tag;
              tagsEl.querySelectorAll('.tag-btn').forEach(function (b) { b.classList.remove('active'); });
              btn.classList.add('active');
              render();
            });
            tagsEl.appendChild(btn);
          });
          searchInput.addEventListener('input', render);
          render();
        });
    })();
  </script>
</body>
</html>`;
}
