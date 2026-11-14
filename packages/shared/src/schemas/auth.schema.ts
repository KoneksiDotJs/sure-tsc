import { z } from 'zod';
import { CurrencyCodeSchema } from './common.schema.js';

export const FamilyRoleEnum = z.enum(['OWNER', 'ADMIN', 'MEMBER']);
export type FamilyRole = z.infer<typeof FamilyRoleEnum>;

export const PermissionLevelEnum = z.enum(['VIEW', 'EDIT', 'FULL']);
export type PermissionLevel = z.infer<typeof PermissionLevelEnum>;

export const RegisterSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1, 'Name is required').max(100),
  familyName: z.string().min(1, 'Family workspace name is required').max(100),
  baseCurrency: CurrencyCodeSchema.default('USD'),
});

export const PasskeyAssertionSchema = z.object({
  id: z.string().min(1),
  rawId: z.string().min(1),
  response: z.object({
    clientDataJSON: z.string().min(1),
    authenticatorData: z.string().min(1),
    signature: z.string().min(1),
    userHandle: z.string().nullable().optional(),
  }),
});

export const PasskeyRegisterVerifySchema = z.object({
  id: z.string().min(1),
  rawId: z.string().min(1),
  name: z.string().min(1).max(80).default('Passkey'),
  challengeToken: z.string().min(1),
  transports: z.array(z.string()).optional(),
  response: z.object({
    clientDataJSON: z.string().min(1),
    attestationObject: z.string().min(1),
  }),
});

export const PasskeyLoginOptionsSchema = z.object({
  email: z.string().email().optional(),
});

export const PasskeyLoginVerifySchema = z.object({
  challengeToken: z.string().min(1),
  assertion: PasskeyAssertionSchema,
});

export const ForgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export const ResetPasswordSchema = z.object({
  token: z.string().min(10, 'Recovery token is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  totpCode: z.string().length(6).optional(),
  passkeyAssertion: PasskeyAssertionSchema.optional(),
  challengeToken: z.string().min(1).optional(),
});

export const EnableMfaSchema = z.object({
  totpCode: z.string().length(6, 'TOTP code must be 6 digits'),
});

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

export const CreateApiKeySchema = z.object({
  name: z.string().min(1).max(80),
  scopes: z
    .array(
      z.enum([
        'accounts:read',
        'accounts:write',
        'transactions:read',
        'transactions:write',
        'budgets:read',
        'reports:read',
        'mcp:tools',
      ])
    )
    .min(1),
  expiresAt: z.string().datetime().optional(),
});

export const UpdateFamilySettingsSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  baseCurrency: CurrencyCodeSchema.optional(),
  aiEnabled: z.boolean().optional(),
  locale: z.string().min(2).max(20).optional(),
  dateFormat: z.string().min(4).max(20).optional(),
});

export const InviteFamilyMemberSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  role: FamilyRoleEnum.default('MEMBER'),
});

export const AccountShareSchema = z.object({
  accountId: z.string().uuid(),
  membershipId: z.string().uuid(),
  permission: PermissionLevelEnum,
});

export const BudgetShareSchema = z.object({
  budgetId: z.string().uuid(),
  membershipId: z.string().uuid(),
  permission: PermissionLevelEnum,
});

export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;
export type PasskeyAssertionInput = z.infer<typeof PasskeyAssertionSchema>;
export type PasskeyRegisterVerifyInput = z.infer<typeof PasskeyRegisterVerifySchema>;
export type PasskeyLoginVerifyInput = z.infer<typeof PasskeyLoginVerifySchema>;
export type CreateApiKeyInput = z.infer<typeof CreateApiKeySchema>;
export type UpdateFamilySettingsInput = z.infer<typeof UpdateFamilySettingsSchema>;
export type InviteFamilyMemberInput = z.infer<typeof InviteFamilyMemberSchema>;
