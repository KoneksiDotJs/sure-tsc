import { z } from 'zod';
import {
  CurrencyCodeSchema,
  DecimalStringSchema,
  IsoDateStringSchema,
  PaginationQuerySchema,
} from './common.schema.js';

export const EntryTypeEnum = z.enum(['TRANSACTION', 'VALUATION', 'TRADE']);
export type EntryType = z.infer<typeof EntryTypeEnum>;

export const ValuationKindEnum = z.enum(['OPENING', 'RECONCILIATION', 'MARKET']);
export type ValuationKind = z.infer<typeof ValuationKindEnum>;

export const TradeActionEnum = z.enum(['BUY', 'SELL', 'DIVIDEND', 'SPLIT']);
export type TradeAction = z.infer<typeof TradeActionEnum>;

export const CreateEntrySchema = z.discriminatedUnion('entryType', [
  z.object({
    entryType: z.literal('TRANSACTION'),
    accountId: z.string().uuid(),
    date: IsoDateStringSchema,
    amount: DecimalStringSchema, // Positive = inflow, Negative = outflow
    currency: CurrencyCodeSchema.default('USD'),
    name: z.string().min(1).max(200),
    categoryId: z.string().uuid().nullable().optional(),
    merchantId: z.string().uuid().nullable().optional(),
    tagIds: z.array(z.string().uuid()).default([]),
    notes: z.string().max(1000).nullable().optional(),
    excluded: z.boolean().default(false),
    attachments: z.array(z.string()).default([]),
  }),
  z.object({
    entryType: z.literal('VALUATION'),
    accountId: z.string().uuid(),
    date: IsoDateStringSchema,
    amount: DecimalStringSchema, // Target anchored balance on `date`
    currency: CurrencyCodeSchema.default('USD'),
    name: z.string().min(1).max(200).default('Balance Valuation'),
    valuationKind: ValuationKindEnum.default('RECONCILIATION'),
    notes: z.string().max(1000).nullable().optional(),
  }),
  z.object({
    entryType: z.literal('TRADE'),
    accountId: z.string().uuid(),
    date: IsoDateStringSchema,
    amount: DecimalStringSchema, // Total cash impact (qty * price + fees)
    currency: CurrencyCodeSchema.default('USD'),
    name: z.string().min(1).max(200),
    securityTicker: z.string().min(1).max(20),
    securityName: z.string().min(1).max(120),
    tradeAction: TradeActionEnum,
    qty: DecimalStringSchema,
    price: DecimalStringSchema,
    fees: DecimalStringSchema.default('0.0000'),
    notes: z.string().max(1000).nullable().optional(),
  }),
]);

export const UpdateEntrySchema = z.object({
  date: IsoDateStringSchema.optional(),
  amount: DecimalStringSchema.optional(),
  name: z.string().min(1).max(200).optional(),
  categoryId: z.string().uuid().nullable().optional(),
  merchantId: z.string().uuid().nullable().optional(),
  tagIds: z.array(z.string().uuid()).optional(),
  notes: z.string().max(1000).nullable().optional(),
  excluded: z.boolean().optional(),
});

export const SplitItemSchema = z.object({
  name: z.string().min(1).max(200),
  amount: DecimalStringSchema,
  categoryId: z.string().uuid().nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

export const SplitTransactionSchema = z.object({
  splits: z.array(SplitItemSchema).min(2, 'A split requires at least 2 child entries'),
});

export const MatchTransferSchema = z.object({
  outflowEntryId: z.string().uuid(),
  inflowEntryId: z.string().uuid(),
});

export const CreateTransferSchema = z.object({
  fromAccountId: z.string().uuid(),
  toAccountId: z.string().uuid(),
  date: IsoDateStringSchema,
  amount: DecimalStringSchema,
  name: z.string().min(1).max(200).optional(),
  notes: z.string().max(1000).nullable().optional(),
});

export const BulkEntryUpdateSchema = z.object({
  entryIds: z.array(z.string().uuid()).min(1),
  action: z.enum(['CATEGORIZE', 'ASSIGN_MERCHANT', 'ADD_TAGS', 'TOGGLE_EXCLUDED', 'DELETE']),
  categoryId: z.string().uuid().nullable().optional(),
  merchantId: z.string().uuid().nullable().optional(),
  tagIds: z.array(z.string().uuid()).optional(),
  excluded: z.boolean().optional(),
});

export const EntryFilterQuerySchema = PaginationQuerySchema.extend({
  accountId: z.string().uuid().optional(),
  entryType: EntryTypeEnum.optional(),
  categoryId: z.string().uuid().optional(),
  merchantId: z.string().uuid().optional(),
  tagId: z.string().uuid().optional(),
  search: z.string().optional(),
  startDate: IsoDateStringSchema.optional(),
  endDate: IsoDateStringSchema.optional(),
  minAmount: DecimalStringSchema.optional(),
  maxAmount: DecimalStringSchema.optional(),
});

export type CreateEntryInput = z.infer<typeof CreateEntrySchema>;
export type UpdateEntryInput = z.infer<typeof UpdateEntrySchema>;
export type SplitTransactionInput = z.infer<typeof SplitTransactionSchema>;
export type MatchTransferInput = z.infer<typeof MatchTransferSchema>;
export type CreateTransferInput = z.infer<typeof CreateTransferSchema>;
export type BulkEntryUpdateInput = z.infer<typeof BulkEntryUpdateSchema>;
export type EntryFilterQuery = z.infer<typeof EntryFilterQuerySchema>;
