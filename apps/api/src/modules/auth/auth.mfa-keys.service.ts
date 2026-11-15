import { randomBytes } from 'node:crypto';
import { CreateApiKeyInput } from '@sure/shared';
import {
  buildTotpUri,
  generateTotpSecret,
  hashApiKey,
  hashPassword,
  verifyPassword,
  verifyTotpCode,
} from '../../config/crypto.js';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../middleware/pipeline.js';

export class AuthMfaKeysService {
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

export const authMfaKeysService = new AuthMfaKeysService();
