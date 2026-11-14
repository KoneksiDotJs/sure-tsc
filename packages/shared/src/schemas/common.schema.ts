import { z } from 'zod';
import { DECIMAL_STRING_REGEX } from '../math/decimal.js';

export const DecimalStringSchema = z
  .string()
  .regex(DECIMAL_STRING_REGEX, 'Must be a valid decimal string (up to 4 decimal places)');

export const CurrencyCodeSchema = z
  .string()
  .length(3, 'Currency must be an ISO 4217 3-letter code')
  .transform((val) => val.toUpperCase());

export const IsoDateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be an ISO date string (YYYY-MM-DD)');

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(200).default(50),
});

export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

export interface PaginationMeta {
  page: number;
  perPage: number;
  totalCount: number;
  totalPages: number;
}

export interface ApiSuccessEnvelope<T> {
  data: T;
  meta?: PaginationMeta;
}

export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INTERNAL_ERROR';

export interface ApiErrorEnvelope {
  error: {
    code: ApiErrorCode;
    message: string;
    details?: Array<{ field: string; message: string }>;
  };
}
