import { randomBytes } from 'node:crypto';
import {
  CreateApiKeyInput,
  FamilyRole,
  LoginInput,
  RegisterInput,
} from '@sure/shared';
import {
  buildTotpUri,
  generateTotpSecret,
  hashApiKey,
  hashPassword,
  signSessionToken,
  verifyPassword,
  verifyTotpCode,
} from '../../config/crypto.js';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../middleware/pipeline.js';

const DEFAULT_CATEGORIES: Array<{
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

export class AuthService {
  public async register(input: RegisterInput) {
    const email = input.email.trim().toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new AppError('CONFLICT', 'An account with this email already exists');
    }

    const passwordHash = hashPassword(input.password);

    const created = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          name: input.name.trim(),
          emailVerifiedAt: new Date(),
        },
      });

      const family = await tx.family.create({
        data: {
          name: input.familyName.trim(),
          baseCurrency: input.baseCurrency.toUpperCase(),
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

    const token = signSessionToken({
      userId: created.user.id,
      familyId: created.family.id,
      role: 'OWNER',
    });

    return {
      token,
      role: 'OWNER' as FamilyRole,
      user: {
        id: created.user.id,
        email: created.user.email,
        name: created.user.name,
        mfaEnabled: created.user.mfaEnabled,
      },
      family: created.family,
    };
  }

  public async login(input: LoginInput) {
    const email = input.email.trim().toLowerCase();
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        memberships: {
          include: { family: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!user || !verifyPassword(input.password, user.passwordHash)) {
      throw new AppError('UNAUTHORIZED', 'Invalid email or password');
    }

    if (user.mfaEnabled) {
      if (!input.totpCode) {
        throw new AppError('UNAUTHORIZED', 'TOTP MFA code required');
      }
      if (!user.totpSecret || !verifyTotpCode(user.totpSecret, input.totpCode)) {
        throw new AppError('UNAUTHORIZED', 'Invalid TOTP MFA code');
      }
    }

    const membership = user.memberships[0];
    if (!membership) {
      throw new AppError('FORBIDDEN', 'User is not a member of any family workspace');
    }

    const role = membership.role as FamilyRole;
    const token = signSessionToken({
      userId: user.id,
      familyId: membership.familyId,
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
      family: membership.family,
    };
  }

  public async getMe(userId: string, familyId: string, role: FamilyRole) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        mfaEnabled: true,
        isSuperAdmin: true,
      },
    });
    const family = await prisma.family.findUnique({
      where: { id: familyId },
    });

    if (!user || !family) {
      throw new AppError('UNAUTHORIZED', 'Session is no longer valid');
    }

    const memberships = await prisma.familyMembership.findMany({
      where: { familyId },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const apiKeys = await prisma.apiKey.findMany({
      where: { familyId },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        lastUsedAt: true,
        expiresAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      user,
      family,
      role,
      memberships: memberships.map((m) => ({
        id: m.id,
        userId: m.userId,
        name: m.user.name,
        email: m.user.email,
        role: m.role,
      })),
      apiKeys,
    };
  }

  public async setupMfa(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError('NOT_FOUND', 'User not found');

    const secret = generateTotpSecret();
    await prisma.user.update({
      where: { id: userId },
      data: { totpSecret: secret, mfaEnabled: false },
    });

    return {
      secret,
      otpauthUri: buildTotpUri(user.email, secret),
    };
  }

  public async enableMfa(userId: string, totpCode: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.totpSecret) {
      throw new AppError('VALIDATION_ERROR', 'MFA setup has not been initiated');
    }
    if (!verifyTotpCode(user.totpSecret, totpCode)) {
      throw new AppError('VALIDATION_ERROR', 'Invalid TOTP verification code');
    }

    await prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: true },
    });

    return { mfaEnabled: true };
  }

  public async disableMfa(userId: string) {
    await prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: false, totpSecret: null },
    });
    return { mfaEnabled: false };
  }

  public async listApiKeys(familyId: string) {
    return prisma.apiKey.findMany({
      where: { familyId },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        lastUsedAt: true,
        expiresAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  public async createApiKey(familyId: string, userId: string, input: CreateApiKeyInput) {
    const rawSecret = `sure_live_${randomBytes(20).toString('hex')}`;
    const keyHash = hashApiKey(rawSecret);
    const keyPrefix = `${rawSecret.slice(0, 16)}...`;

    const created = await prisma.apiKey.create({
      data: {
        familyId,
        userId,
        name: input.name,
        keyHash,
        keyPrefix,
        scopes: input.scopes,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      },
    });

    return {
      id: created.id,
      name: created.name,
      keyPrefix: created.keyPrefix,
      scopes: created.scopes,
      createdAt: created.createdAt,
      secret: rawSecret,
    };
  }

  public async deleteApiKey(familyId: string, keyId: string) {
    const existing = await prisma.apiKey.findFirst({
      where: { id: keyId, familyId },
    });
    if (!existing) {
      throw new AppError('NOT_FOUND', 'API key not found');
    }
    await prisma.apiKey.delete({ where: { id: keyId } });
  }

  public async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new AppError('NOT_FOUND', 'User not found');
    }
    if (!verifyPassword(currentPassword, user.passwordHash)) {
      throw new AppError('UNAUTHORIZED', 'Current password is incorrect');
    }
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: hashPassword(newPassword) },
    });
    return { updated: true };
  }
}

export const authService = new AuthService();
