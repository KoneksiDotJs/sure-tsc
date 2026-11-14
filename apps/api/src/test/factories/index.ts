import { randomUUID } from 'node:crypto';
import { prisma } from '../../config/prisma.js';
import { hashPassword, signSessionToken } from '../../config/crypto.js';
import { accountsService } from '../../modules/accounts/accounts.service.js';
import { entriesService } from '../../modules/entries/entries.service.js';

const createdFamilyIds: string[] = [];

/**
 * Deterministic test data factories backed by real PostgreSQL via Prisma
 * (`docs/llm-guides/05-testing-guidelines.md` Section 3)
 */
export async function createTestFamily(overrides?: {
  name?: string;
  baseCurrency?: string;
  aiEnabled?: boolean;
}) {
  const familyId = randomUUID();
  const userId = randomUUID();

  await prisma.family.create({
    data: {
      id: familyId,
      name: overrides?.name ?? 'Test Family',
      baseCurrency: overrides?.baseCurrency ?? 'USD',
      aiEnabled: overrides?.aiEnabled ?? false,
      locale: 'en-US',
      dateFormat: 'YYYY-MM-DD',
    },
  });

  await prisma.user.create({
    data: {
      id: userId,
      email: `user-${userId.slice(0, 8)}@sure.test`,
      passwordHash: hashPassword('TestPass123!'),
      name: 'Test Owner',
      mfaEnabled: false,
      isSuperAdmin: false,
    },
  });

  await prisma.familyMembership.create({
    data: {
      familyId,
      userId,
      role: 'OWNER',
    },
  });

  createdFamilyIds.push(familyId);

  const authToken = signSessionToken({
    userId,
    familyId,
    role: 'OWNER',
  });

  return {
    familyId,
    userId,
    authToken,
  };
}

export async function cleanupTestFamilies() {
  if (createdFamilyIds.length === 0) return;
  const ids = [...createdFamilyIds];
  createdFamilyIds.length = 0;

  await prisma.family.deleteMany({
    where: { id: { in: ids } },
  });
  await prisma.user.deleteMany({
    where: {
      email: { endsWith: '@sure.test' },
    },
  });
}

export async function createTestAccount(
  familyId: string,
  overrides?: {
    name?: string;
    initialBalance?: string;
    currency?: string;
  }
) {
  return accountsService.createAccount(familyId, {
    accountType: 'DEPOSITORY',
    name: overrides?.name ?? 'Primary Checking',
    currency: overrides?.currency ?? 'USD',
    initialBalance: overrides?.initialBalance ?? '1000.0000',
    color: '#10b981',
    icon: 'Wallet',
    subtypeDetails: {
      accountSubtype: 'CHECKING',
      institutionName: 'Mercury',
    },
  });
}

export async function createTestTransaction(
  familyId: string,
  accountId: string,
  overrides?: {
    date?: string;
    amount?: string;
    name?: string;
  }
) {
  return entriesService.createEntry(familyId, {
    entryType: 'TRANSACTION',
    accountId,
    date: overrides?.date ?? '2026-11-10',
    amount: overrides?.amount ?? '-45.5000',
    currency: 'USD',
    name: overrides?.name ?? 'Coffee Shop',
    tagIds: [],
    excluded: false,
    attachments: [],
  });
}
