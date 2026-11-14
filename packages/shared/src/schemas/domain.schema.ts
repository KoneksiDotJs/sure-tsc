import { z } from 'zod';
import { DecimalStringSchema, IsoDateStringSchema } from './common.schema.js';

// Taxonomies: Categories, Merchants, Tags
export const CategoryClassificationEnum = z.enum(['INCOME', 'EXPENSE', 'TRANSFER']);
export type CategoryClassification = z.infer<typeof CategoryClassificationEnum>;

export const CreateCategorySchema = z.object({
  name: z.string().min(1).max(80),
  classification: CategoryClassificationEnum.default('EXPENSE'),
  color: z.string().default('#3b82f6'),
  icon: z.string().default('Tag'),
  parentId: z.string().uuid().nullable().optional(),
});

export const CreateMerchantSchema = z.object({
  name: z.string().min(1).max(120),
  color: z.string().default('#6366f1'),
  icon: z.string().default('Store'),
  website: z.string().optional(),
  defaultCategoryId: z.string().uuid().nullable().optional(),
});

export const CreateTagSchema = z.object({
  name: z.string().min(1).max(60),
  color: z.string().default('#10b981'),
});

// FR-3.1: Multi-Format Importer (CSV, QIF, OFX, PDF)
export const ImportFormatEnum = z.enum(['CSV', 'QIF', 'OFX', 'PDF']);
export type ImportFormat = z.infer<typeof ImportFormatEnum>;

export const ImportColumnMappingSchema = z.object({
  dateColumn: z.string(),
  nameColumn: z.string(),
  amountColumn: z.string(),
  categoryColumn: z.string().optional(),
  merchantColumn: z.string().optional(),
  notesColumn: z.string().optional(),
  invertSign: z.boolean().default(false),
});

export const CreateImportPreviewSchema = z.object({
  accountId: z.string().uuid(),
  format: ImportFormatEnum,
  fileName: z.string().min(1),
  rawContent: z.string().min(1),
  columnMapping: ImportColumnMappingSchema.optional(),
});

export const CommitImportSchema = z.object({
  importId: z.string().uuid(),
  rows: z.array(
    z.object({
      date: IsoDateStringSchema,
      name: z.string().min(1),
      amount: DecimalStringSchema,
      categoryName: z.string().optional(),
      merchantName: z.string().optional(),
      notes: z.string().optional(),
      skip: z.boolean().default(false),
    })
  ),
});

// FR-3.2: Rule Engine
export const RuleFieldEnum = z.enum([
  'merchant',
  'name',
  'notes',
  'amount',
  'account',
  'transaction_type',
]);
export type RuleField = z.infer<typeof RuleFieldEnum>;

export const RuleOperatorEnum = z.enum([
  'equals',
  'contains',
  'starts_with',
  'gt',
  'lt',
  'between',
]);
export type RuleOperator = z.infer<typeof RuleOperatorEnum>;

export const RuleConditionSchema = z.object({
  field: RuleFieldEnum,
  operator: RuleOperatorEnum,
  value: z.string(),
  secondaryValue: z.string().optional(), // Used when operator === 'between'
});

export const RuleActionSchema = z.object({
  setCategoryId: z.string().uuid().optional(),
  setMerchantId: z.string().uuid().optional(),
  addTagIds: z.array(z.string().uuid()).optional(),
  setDisplayName: z.string().optional(),
  setExcluded: z.boolean().optional(),
  splitRatios: z
    .array(
      z.object({
        categoryId: z.string().uuid(),
        percentage: DecimalStringSchema,
        label: z.string(),
      })
    )
    .optional(),
});

export const CreateRuleSchema = z.object({
  name: z.string().min(1).max(120),
  groupName: z.string().default('General'),
  priority: z.number().int().min(1).max(1000).default(100),
  matchMode: z.enum(['ALL', 'ANY']).default('ALL'),
  isActive: z.boolean().default(true),
  conditions: z.array(RuleConditionSchema).min(1),
  actions: RuleActionSchema,
});

export const UpdateRuleSchema = CreateRuleSchema.partial();

export const UpsertHoldingSchema = z.object({
  ticker: z.string().min(1).max(20),
  securityName: z.string().min(1).max(120),
  assetClass: z.string().default('EQUITY'),
  qty: DecimalStringSchema,
  avgCostBasis: DecimalStringSchema,
  currentPrice: DecimalStringSchema,
});

export const CreateProviderConnectionSchema = z.object({
  providerKey: z.string().min(1).max(60),
  institutionName: z.string().min(1).max(120),
  accountId: z.string().uuid().optional(),
});

// FR-4.1: Monthly Budgeting with Rollover
export const UpsertBudgetMonthSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Must be YYYY-MM'),
  rolloverEnabled: z.boolean().default(true),
  expectedIncome: DecimalStringSchema.default('0.0000'),
  allocations: z.array(
    z.object({
      categoryId: z.string().uuid(),
      budgetedAmount: DecimalStringSchema,
      rolloverEnabled: z.boolean().default(true),
    })
  ),
});

// FR-4.2: Financial Goals
export const CreateGoalSchema = z.object({
  name: z.string().min(1).max(120),
  targetAmount: DecimalStringSchema,
  currentAmount: DecimalStringSchema.default('0.0000'),
  monthlyPledge: DecimalStringSchema.default('0.0000'),
  targetDate: IsoDateStringSchema,
  color: z.string().default('#10b981'),
  icon: z.string().default('Target'),
  linkedAccountIds: z.array(z.string().uuid()).default([]),
});

// FR-4.3: Recurring Transactions & Bills
export const RecurringCadenceEnum = z.enum(['WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY']);
export type RecurringCadence = z.infer<typeof RecurringCadenceEnum>;

export const CreateRecurringSchema = z.object({
  name: z.string().min(1).max(120),
  amount: DecimalStringSchema,
  currency: z.string().length(3).default('USD'),
  cadence: RecurringCadenceEnum.default('MONTHLY'),
  nextOccurrenceDate: IsoDateStringSchema,
  accountId: z.string().uuid(),
  categoryId: z.string().uuid().nullable().optional(),
  merchantId: z.string().uuid().nullable().optional(),
  autoPay: z.boolean().default(true),
});

// FR-6: Provider Sync & FinanceKit Conflict Resolution
export const ResolveFinancekitConflictSchema = z.object({
  conflictId: z.string().uuid(),
  resolution: z.enum(['KEEP_BOTH', 'MERGE_INTO_EXISTING', 'DISCARD_INCOMING', 'MAP_ACCOUNT']),
  targetAccountId: z.string().uuid().optional(),
});

// FR-7: AI Financial Assistant
export const AiProviderEnum = z.enum([
  'auto',
  'groq',
  'gemini',
  'openrouter',
  'ollama',
  'openai',
  'anthropic',
]);

export const AiConfigUpdateSchema = z.object({
  provider: AiProviderEnum.default('groq'),
  apiKey: z.string().max(400).optional(),
  model: z.string().max(120).optional(),
  baseUrl: z.string().max(300).optional(),
  clearApiKey: z.boolean().optional(),
});

export const AiChatMessageInputSchema = z.object({
  chatId: z.string().uuid().optional(),
  prompt: z.string().min(1).max(4000),
  systemPrompt: z.string().max(4000).optional(),
});

export type CreateCategoryInput = z.infer<typeof CreateCategorySchema>;
export type CreateMerchantInput = z.infer<typeof CreateMerchantSchema>;
export type CreateTagInput = z.infer<typeof CreateTagSchema>;
export type RuleCondition = z.infer<typeof RuleConditionSchema>;
export type RuleAction = z.infer<typeof RuleActionSchema>;
export type CreateRuleInput = z.infer<typeof CreateRuleSchema>;
export type UpsertBudgetMonthInput = z.infer<typeof UpsertBudgetMonthSchema>;
export type CreateGoalInput = z.infer<typeof CreateGoalSchema>;
export type CreateRecurringInput = z.infer<typeof CreateRecurringSchema>;
export type ResolveFinancekitConflictInput = z.infer<typeof ResolveFinancekitConflictSchema>;
export type AiProvider = z.infer<typeof AiProviderEnum>;
export type AiConfigUpdateInput = z.infer<typeof AiConfigUpdateSchema>;
export type AiChatMessageInput = z.infer<typeof AiChatMessageInputSchema>;
