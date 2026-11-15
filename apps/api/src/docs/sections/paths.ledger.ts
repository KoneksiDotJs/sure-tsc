import { EntryFilterQuerySchema } from '@sure/shared';
import {
  createdJson,
  errorResponses,
  jsonRequestBody,
  okJson,
  OpenApiOperationObject,
  pathParam,
} from './types.js';
import { queryParamsFromZodObject } from './zod-mapper.js';

export const ledgerPaths: Record<string, Record<string, OpenApiOperationObject>> = {
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
      responses: okJson(
        { type: 'array', items: { type: 'object', additionalProperties: true } },
        true
      ),
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
};
