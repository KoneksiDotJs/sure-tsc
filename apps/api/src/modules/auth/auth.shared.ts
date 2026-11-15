import { FamilyRole } from '@sure/shared';
import { hashPassword, signSessionToken } from '../../config/crypto.js';
import { prisma } from '../../config/prisma.js';
import { StoredPasskeyCredential } from './webauthn.js';

export const DEFAULT_CATEGORIES: Array<{
  name: string;
  classification: 'INCOME' | 'EXPENSE' | 'TRANSFER';
  color: string;
  icon: string;
}> = [
  { name: 'Salary & Compensation', classification: 'INCOME', color: '#10b981', icon: 'Briefcase' },
  { name: 'Dividends & Yield', classification: 'INCOME', color: '#14b8a6', icon: 'TrendingUp' },
  { name: 'Housing & Mortgage', classification: 'EXPENSE', color: '#8b5cf6', icon: 'Home' },
  { name: 'Groceries & Dining', classification: 'EXPENSE', color: '#f59e0b', icon: 'Utensils' },
  { name: 'Software & Cloud', classification: 'EXPENSE', color: '#3b82f6', icon: 'Zap' },
  { name: 'Travel & Transit', classification: 'EXPENSE', color: '#06b6d4', icon: 'Plane' },
  { name: 'Shopping & Gear', classification: 'EXPENSE', color: '#ec4899', icon: 'ShoppingBag' },
];

export function parsePasskeys(raw: unknown): StoredPasskeyCredential[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (item): item is StoredPasskeyCredential =>
      Boolean(item) &&
      typeof item === 'object' &&
      typeof (item as StoredPasskeyCredential).credentialIdB64Url === 'string' &&
      typeof (item as StoredPasskeyCredential).publicKeyPem === 'string'
  );
}

export async function provisionUserWithFamily(params: {
  email: string;
  password: string;
  name: string;
  familyName: string;
  baseCurrency: string;
}) {
  const passwordHash = hashPassword(params.password);

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: params.email,
        passwordHash,
        name: params.name,
        emailVerifiedAt: new Date(),
      },
    });

    const family = await tx.family.create({
      data: {
        name: params.familyName,
        baseCurrency: params.baseCurrency.toUpperCase(),
      },
    });

    await tx.familyMembership.create({
      data: {
        familyId: family.id,
        userId: user.id,
        role: 'OWNER',
      },
    });

    await tx.category.createMany({
      data: DEFAULT_CATEGORIES.map((c) => ({
        familyId: family.id,
        name: c.name,
        classification: c.classification,
        color: c.color,
        icon: c.icon,
      })),
    });

    return { user, family };
  });
}

export function buildAuthSessionResponse<TFamily extends { id: string }>(
  user: { id: string; email: string; name: string; mfaEnabled: boolean },
  family: TFamily,
  role: FamilyRole
) {
  const token = signSessionToken({
    userId: user.id,
    familyId: family.id,
    role,
  });

  return {
    token,
    role,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      mfaEnabled: user.mfaEnabled,
    },
    family,
  };
}
