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

export function ref(schemaName: string): OpenApiSchemaObject {
  return { $ref: `#/components/schemas/${schemaName}` };
}

export function dataEnvelope(dataSchema: OpenApiSchemaObject, withMeta = false): OpenApiSchemaObject {
  return {
    type: 'object',
    properties: {
      data: dataSchema,
      ...(withMeta ? { meta: ref('PaginationMeta') } : {}),
    },
    required: ['data'],
  };
}

export function errorResponses(): Record<
  string,
  { description: string; content: { 'application/json': { schema: OpenApiSchemaObject } } }
> {
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

export function jsonRequestBody(
  schemaName: string,
  description?: string
): OpenApiOperationObject['requestBody'] {
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

export function pathParam(
  name: string,
  description: string,
  format: 'uuid' | 'string' = 'uuid'
): OpenApiParameterObject {
  return {
    name,
    in: 'path',
    required: true,
    description,
    schema: format === 'uuid' ? { type: 'string', format: 'uuid' } : { type: 'string' },
  };
}

export function okJson(
  dataSchema: OpenApiSchemaObject = { type: 'object', additionalProperties: true },
  withMeta = false
) {
  return {
    '200': {
      description: 'Successful response',
      content: { 'application/json': { schema: dataEnvelope(dataSchema, withMeta) } },
    },
    ...errorResponses(),
  };
}

export function createdJson(
  dataSchema: OpenApiSchemaObject = { type: 'object', additionalProperties: true }
) {
  return {
    '201': {
      description: 'Resource created',
      content: { 'application/json': { schema: dataEnvelope(dataSchema) } },
    },
    ...errorResponses(),
  };
}
