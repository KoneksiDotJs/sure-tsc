import { z } from 'zod';
import { OpenApiParameterObject, OpenApiSchemaObject } from './types.js';

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
        type:
          typeof def.value === 'number'
            ? 'number'
            : typeof def.value === 'boolean'
              ? 'boolean'
              : 'string',
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

export function queryParamsFromZodObject(
  schema: z.ZodObject<z.ZodRawShape>
): OpenApiParameterObject[] {
  return Object.entries(schema.shape).map(([name, fieldSchema]) => ({
    name,
    in: 'query',
    required: !isZodOptional(fieldSchema),
    schema: zodToOpenApi(fieldSchema),
  }));
}
