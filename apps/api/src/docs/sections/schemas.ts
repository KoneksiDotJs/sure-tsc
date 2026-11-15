import {
  AddWatchlistTickerSchema,
  AiChatExportQuerySchema,
  AiChatMessageInputSchema,
  BulkEntryUpdateSchema,
  ChangePasswordSchema,
  CommitImportSchema,
  CreateAccountSchema,
  CreateApiKeySchema,
  CreateCategorySchema,
  CreateEntrySchema,
  CreateGoalSchema,
  CreateImportPreviewSchema,
  CreateMerchantSchema,
  CreateProviderConnectionSchema,
  UpdateProviderConnectionSchema,
  CreateRecurringSchema,
  CreateRuleSchema,
  CreateTagSchema,
  CreateTransferSchema,
  EnableMfaSchema,
  EntryFilterQuerySchema,
  InviteFamilyMemberSchema,
  LoanSimulationInputSchema,
  LoginSchema,
  MarketHistoryQuerySchema,
  MatchTransferSchema,
  RegisterSchema,
  ResolveFinancekitConflictSchema,
  SplitTransactionSchema,
  UpdateAccountSchema,
  UpdateEntrySchema,
  UpdateFamilySettingsSchema,
  UpdateRuleSchema,
  UpsertBudgetMonthSchema,
  UpsertHoldingSchema,
  UpdateAiChatSchema,
} from '@sure/shared';
import { OpenApiSchemaObject } from './types.js';
import { zodToOpenApi } from './zod-mapper.js';

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
  UpdateProviderConnectionSchema,
  AddWatchlistTickerSchema,
  MarketHistoryQuerySchema,
  ResolveFinancekitConflictSchema,
  AiChatMessageInputSchema,
  UpdateAiChatSchema,
  AiChatExportQuerySchema,
} as const;

export function buildComponentSchemas(): Record<string, OpenApiSchemaObject> {
  const generatedSchemas: Record<string, OpenApiSchemaObject> = {};
  for (const [name, zodSchema] of Object.entries(schemaRegistry)) {
    generatedSchemas[name] = zodToOpenApi(zodSchema);
  }

  return {
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
              enum: [
                'VALIDATION_ERROR',
                'UNAUTHORIZED',
                'FORBIDDEN',
                'NOT_FOUND',
                'CONFLICT',
                'INTERNAL_ERROR',
              ],
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
}
