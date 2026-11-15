import {
  createdJson,
  dataEnvelope,
  errorResponses,
  jsonRequestBody,
  okJson,
  OpenApiOperationObject,
  pathParam,
  ref,
} from './types.js';

export const systemAuthFamilyPaths: Record<string, Record<string, OpenApiOperationObject>> = {
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
};
