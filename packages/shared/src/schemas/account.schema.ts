import { z } from 'zod';
import { CurrencyCodeSchema, DecimalStringSchema } from './common.schema.js';

export const AccountTypeEnum = z.enum([
  'DEPOSITORY',
  'CREDIT_CARD',
  'INVESTMENT',
  'CRYPTO',
  'PROPERTY',
  'VEHICLE',
  'LOAN',
  'OTHER_ASSET',
  'OTHER_LIABILITY',
]);

export type AccountType = z.infer<typeof AccountTypeEnum>;

export const AccountClassificationEnum = z.enum(['ASSET', 'LIABILITY']);
export type AccountClassification = z.infer<typeof AccountClassificationEnum>;

export function getClassificationForAccountType(type: AccountType): AccountClassification {
  switch (type) {
    case 'CREDIT_CARD':
    case 'LOAN':
    case 'OTHER_LIABILITY':
      return 'LIABILITY';
    default:
      return 'ASSET';
  }
}

export const DepositoryDetailsSchema = z.object({
  accountSubtype: z.enum(['CHECKING', 'SAVINGS', 'CASH', 'MONEY_MARKET']).default('CHECKING'),
  institutionName: z.string().optional(),
  accountNumberLast4: z.string().max(4).optional(),
  apyPercent: DecimalStringSchema.optional(),
});

export const CreditCardDetailsSchema = z.object({
  creditLimit: DecimalStringSchema,
  aprPercent: DecimalStringSchema,
  statementDay: z.number().int().min(1).max(31).optional(),
  dueDay: z.number().int().min(1).max(31),
  institutionName: z.string().optional(),
});

export const InvestmentDetailsSchema = z.object({
  accountSubtype: z.enum(['BROKERAGE', 'RETIREMENT_401K', 'IRA', 'ROTH_IRA', 'HSA', 'PENSION']).default('BROKERAGE'),
  institutionName: z.string().optional(),
  taxAdvantaged: z.boolean().default(false),
});

export const CryptoDetailsSchema = z.object({
  walletType: z.enum(['EXCHANGE', 'ON_CHAIN']).default('EXCHANGE'),
  chain: z.enum(['ETHEREUM', 'BITCOIN', 'SOLANA', 'COSMOS', 'POLKADOT', 'MULTI']).optional(),
  walletAddress: z.string().optional(),
  exchangeName: z.string().optional(),
});

export const PropertyDetailsSchema = z.object({
  address: z.string().min(1),
  propertyType: z.enum(['PRIMARY_RESIDENCE', 'RENTAL', 'COMMERCIAL', 'LAND']).default('PRIMARY_RESIDENCE'),
  purchasePrice: DecimalStringSchema,
  purchaseDate: z.string().optional(),
  valuationSource: z.enum(['MANUAL', 'ZILLOW', 'APPRAISAL']).default('MANUAL'),
});

export const VehicleDetailsSchema = z.object({
  make: z.string().min(1),
  model: z.string().min(1),
  year: z.number().int().min(1900).max(2100),
  mileage: z.number().int().min(0).optional(),
  vin: z.string().optional(),
});

export const LoanDetailsSchema = z.object({
  loanSubtype: z.enum(['MORTGAGE', 'AUTO', 'STUDENT', 'PERSONAL', 'HELOC']).default('MORTGAGE'),
  principal: DecimalStringSchema,
  interestRatePercent: DecimalStringSchema,
  termMonths: z.number().int().min(1).max(600),
  rateType: z.enum(['FIXED', 'VARIABLE']).default('FIXED'),
  originationDate: z.string().optional(),
  linkedPropertyId: z.string().uuid().optional(),
});

export const OtherAssetDetailsSchema = z.object({
  description: z.string().optional(),
  liquid: z.boolean().default(false),
});

export const OtherLiabilityDetailsSchema = z.object({
  description: z.string().optional(),
  creditor: z.string().optional(),
});

export const CreateAccountSchema = z.discriminatedUnion('accountType', [
  z.object({
    accountType: z.literal('DEPOSITORY'),
    name: z.string().min(1).max(120),
    currency: CurrencyCodeSchema.default('USD'),
    initialBalance: DecimalStringSchema.default('0.0000'),
    color: z.string().default('#10b981'),
    icon: z.string().default('Wallet'),
    subtypeDetails: DepositoryDetailsSchema,
  }),
  z.object({
    accountType: z.literal('CREDIT_CARD'),
    name: z.string().min(1).max(120),
    currency: CurrencyCodeSchema.default('USD'),
    initialBalance: DecimalStringSchema.default('0.0000'),
    color: z.string().default('#ef4444'),
    icon: z.string().default('CreditCard'),
    subtypeDetails: CreditCardDetailsSchema,
  }),
  z.object({
    accountType: z.literal('INVESTMENT'),
    name: z.string().min(1).max(120),
    currency: CurrencyCodeSchema.default('USD'),
    initialBalance: DecimalStringSchema.default('0.0000'),
    color: z.string().default('#3b82f6'),
    icon: z.string().default('TrendingUp'),
    subtypeDetails: InvestmentDetailsSchema,
  }),
  z.object({
    accountType: z.literal('CRYPTO'),
    name: z.string().min(1).max(120),
    currency: CurrencyCodeSchema.default('USD'),
    initialBalance: DecimalStringSchema.default('0.0000'),
    color: z.string().default('#f59e0b'),
    icon: z.string().default('Coins'),
    subtypeDetails: CryptoDetailsSchema,
  }),
  z.object({
    accountType: z.literal('PROPERTY'),
    name: z.string().min(1).max(120),
    currency: CurrencyCodeSchema.default('USD'),
    initialBalance: DecimalStringSchema.default('0.0000'),
    color: z.string().default('#8b5cf6'),
    icon: z.string().default('Home'),
    subtypeDetails: PropertyDetailsSchema,
  }),
  z.object({
    accountType: z.literal('VEHICLE'),
    name: z.string().min(1).max(120),
    currency: CurrencyCodeSchema.default('USD'),
    initialBalance: DecimalStringSchema.default('0.0000'),
    color: z.string().default('#06b6d4'),
    icon: z.string().default('Car'),
    subtypeDetails: VehicleDetailsSchema,
  }),
  z.object({
    accountType: z.literal('LOAN'),
    name: z.string().min(1).max(120),
    currency: CurrencyCodeSchema.default('USD'),
    initialBalance: DecimalStringSchema.default('0.0000'),
    color: z.string().default('#f43f5e'),
    icon: z.string().default('Landmark'),
    subtypeDetails: LoanDetailsSchema,
  }),
  z.object({
    accountType: z.literal('OTHER_ASSET'),
    name: z.string().min(1).max(120),
    currency: CurrencyCodeSchema.default('USD'),
    initialBalance: DecimalStringSchema.default('0.0000'),
    color: z.string().default('#14b8a6'),
    icon: z.string().default('Briefcase'),
    subtypeDetails: OtherAssetDetailsSchema,
  }),
  z.object({
    accountType: z.literal('OTHER_LIABILITY'),
    name: z.string().min(1).max(120),
    currency: CurrencyCodeSchema.default('USD'),
    initialBalance: DecimalStringSchema.default('0.0000'),
    color: z.string().default('#fb7185'),
    icon: z.string().default('FileWarning'),
    subtypeDetails: OtherLiabilityDetailsSchema,
  }),
]);

export const UpdateAccountSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  isActive: z.boolean().optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
  subtypeDetails: z.record(z.unknown()).optional(),
});

export const LoanSimulationInputSchema = z.object({
  extraMonthlyPayment: DecimalStringSchema.default('0.0000'),
});

export type CreateAccountInput = z.infer<typeof CreateAccountSchema>;
export type UpdateAccountInput = z.infer<typeof UpdateAccountSchema>;
