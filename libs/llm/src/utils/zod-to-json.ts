import { z } from 'zod';

/**
 * Convert a Zod schema to JSON Schema format for LLM structured output
 * This is a simplified implementation that covers common Zod types
 */
export function zodToJsonSchema(schema: z.ZodSchema<unknown>): Record<string, unknown> {
  return convertZodType(schema);
}

function convertZodType(schema: z.ZodTypeAny): Record<string, unknown> {
  const typeName = schema._def.typeName;

  switch (typeName) {
    case 'ZodString':
      return handleString(schema as z.ZodString);
    case 'ZodNumber':
      return handleNumber(schema as z.ZodNumber);
    case 'ZodBoolean':
      return { type: 'boolean' };
    case 'ZodNull':
      return { type: 'null' };
    case 'ZodArray':
      return handleArray(schema as z.ZodArray<z.ZodTypeAny>);
    case 'ZodObject':
      return handleObject(schema as z.ZodObject<z.ZodRawShape>);
    case 'ZodEnum':
      return handleEnum(schema as z.ZodEnum<[string, ...string[]]>);
    case 'ZodNativeEnum':
      return handleNativeEnum(schema);
    case 'ZodUnion':
      return handleUnion(schema as z.ZodUnion<[z.ZodTypeAny, ...z.ZodTypeAny[]]>);
    case 'ZodOptional':
      return convertZodType((schema as z.ZodOptional<z.ZodTypeAny>).unwrap());
    case 'ZodNullable':
      return handleNullable(schema as z.ZodNullable<z.ZodTypeAny>);
    case 'ZodDefault':
      return handleDefault(schema as z.ZodDefault<z.ZodTypeAny>);
    case 'ZodLiteral':
      return handleLiteral(schema as z.ZodLiteral<unknown>);
    case 'ZodRecord':
      return handleRecord(schema as z.ZodRecord<z.ZodString, z.ZodTypeAny>);
    case 'ZodTuple':
      return handleTuple(schema as z.ZodTuple);
    default:
      // Fallback for unsupported types
      return { type: 'string' };
  }
}

function handleString(schema: z.ZodString): Record<string, unknown> {
  const result: Record<string, unknown> = { type: 'string' };

  for (const check of schema._def.checks || []) {
    switch (check.kind) {
      case 'min':
        result.minLength = check.value;
        break;
      case 'max':
        result.maxLength = check.value;
        break;
      case 'email':
        result.format = 'email';
        break;
      case 'url':
        result.format = 'uri';
        break;
      case 'uuid':
        result.format = 'uuid';
        break;
      case 'regex':
        result.pattern = check.regex.source;
        break;
    }
  }

  return result;
}

function handleNumber(schema: z.ZodNumber): Record<string, unknown> {
  const result: Record<string, unknown> = { type: 'number' };

  for (const check of schema._def.checks || []) {
    switch (check.kind) {
      case 'min':
        result.minimum = check.value;
        break;
      case 'max':
        result.maximum = check.value;
        break;
      case 'int':
        result.type = 'integer';
        break;
    }
  }

  return result;
}

function handleArray(schema: z.ZodArray<z.ZodTypeAny>): Record<string, unknown> {
  const result: Record<string, unknown> = {
    type: 'array',
    items: convertZodType(schema._def.type),
  };

  if (schema._def.minLength !== null) {
    result.minItems = schema._def.minLength.value;
  }
  if (schema._def.maxLength !== null) {
    result.maxItems = schema._def.maxLength.value;
  }

  return result;
}

function handleObject(schema: z.ZodObject<z.ZodRawShape>): Record<string, unknown> {
  const shape = schema._def.shape();
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const [key, value] of Object.entries(shape)) {
    properties[key] = convertZodType(value as z.ZodTypeAny);

    // Check if the field is required (not optional)
    if (!isOptional(value as z.ZodTypeAny)) {
      required.push(key);
    }
  }

  const result: Record<string, unknown> = {
    type: 'object',
    properties,
  };

  if (required.length > 0) {
    result.required = required;
  }

  // Handle strict mode
  if (schema._def.unknownKeys === 'strict') {
    result.additionalProperties = false;
  }

  return result;
}

function handleEnum(schema: z.ZodEnum<[string, ...string[]]>): Record<string, unknown> {
  return {
    type: 'string',
    enum: schema._def.values,
  };
}

function handleNativeEnum(schema: z.ZodTypeAny): Record<string, unknown> {
  const enumValues = Object.values(schema._def.values);
  const types = new Set(enumValues.map((v) => typeof v));

  if (types.has('string') && types.size === 1) {
    return { type: 'string', enum: enumValues };
  }
  if (types.has('number') && types.size === 1) {
    return { type: 'number', enum: enumValues };
  }

  return { enum: enumValues };
}

function handleUnion(
  schema: z.ZodUnion<[z.ZodTypeAny, ...z.ZodTypeAny[]]>,
): Record<string, unknown> {
  const options = schema._def.options.map((opt: z.ZodTypeAny) => convertZodType(opt));
  return { oneOf: options };
}

function handleNullable(schema: z.ZodNullable<z.ZodTypeAny>): Record<string, unknown> {
  const inner = convertZodType(schema.unwrap());
  return {
    oneOf: [inner, { type: 'null' }],
  };
}

function handleDefault(schema: z.ZodDefault<z.ZodTypeAny>): Record<string, unknown> {
  const inner = convertZodType(schema._def.innerType);
  inner.default = schema._def.defaultValue();
  return inner;
}

function handleLiteral(schema: z.ZodLiteral<unknown>): Record<string, unknown> {
  const value = schema._def.value;
  return {
    type: typeof value,
    const: value,
  };
}

function handleRecord(
  schema: z.ZodRecord<z.ZodString, z.ZodTypeAny>,
): Record<string, unknown> {
  return {
    type: 'object',
    additionalProperties: convertZodType(schema._def.valueType),
  };
}

function handleTuple(schema: z.ZodTuple): Record<string, unknown> {
  const items = schema._def.items.map((item: z.ZodTypeAny) => convertZodType(item));
  return {
    type: 'array',
    items,
    minItems: items.length,
    maxItems: items.length,
  };
}

function isOptional(schema: z.ZodTypeAny): boolean {
  if (schema._def.typeName === 'ZodOptional') return true;
  if (schema._def.typeName === 'ZodDefault') return true;
  return false;
}
