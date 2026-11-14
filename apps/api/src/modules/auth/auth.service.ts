import { randomBytes } from 'node:crypto';
import { Prisma } from '@prisma/client';
import {
  CreateApiKeyInput,
  FamilyRole,
  ForgotPasswordInput,
  LoginInput,
  PasskeyLoginVerifyInput,
  PasskeyRegisterVerifyInput,
  RegisterInput,
  ResetPasswordInput,
} from '@sure/shared';
import {
  buildTotpUri,
  createPkcePair,
  generateTotpSecret,
  hashApiKey,
  hashPassword,
  passwordHashFingerprint,
  signEphemeralToken,
  signSessionToken,
  verifyEphemeralToken,
  verifyPassword,
  verifyTotpCode,
} from '../../config/crypto.js';
import { env } from '../../config/env.js';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../middleware/pipeline.js';
import {
  resolveWebAuthnConfig,
  StoredPasskeyCredential,
  verifyPasskeyAuthentication,
  verifyPasskeyRegistration,
} from './webauthn.js';

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

  private parsePasskeys(raw: unknown): StoredPasskeyCredential[] {
    if (!Array.isArray(raw)) return [];
    return raw.filter(
      (item): item is StoredPasskeyCredential =>
        Boolean(item) &&
        typeof item === 'object' &&
        typeof (item as StoredPasskeyCredential).credentialIdB64Url === 'string' &&
        typeof (item as StoredPasskeyCredential).publicKeyPem === 'string'
    );
  }

  public async login(input: LoginInput, requestOrigin?: string) {
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

    const passkeys = this.parsePasskeys(user.passkeyCredentials);

    if (user.mfaEnabled) {
      let mfaSatisfied = false;

      if (input.totpCode) {
        if (!user.totpSecret || !verifyTotpCode(user.totpSecret, input.totpCode)) {
          throw new AppError('UNAUTHORIZED', 'Invalid TOTP MFA code');
        }
        mfaSatisfied = true;
      } else if (input.passkeyAssertion && input.challengeToken) {
        const challengePayload = verifyEphemeralToken<{ challenge: string; userId?: string }>(
          'webauthn_login',
          input.challengeToken
        );
        if (!challengePayload) {
          throw new AppError('UNAUTHORIZED', 'Passkey challenge expired or invalid');
        }
        const matched = passkeys.find(
          (p) =>
            p.credentialIdB64Url === input.passkeyAssertion!.id ||
            p.credentialIdB64Url === input.passkeyAssertion!.rawId
        );
        if (!matched) {
          throw new AppError('UNAUTHORIZED', 'Passkey not recognized for this account');
        }
        const cfg = resolveWebAuthnConfig(requestOrigin);
        try {
          const { newCounter } = verifyPasskeyAuthentication({
            clientDataJSON: input.passkeyAssertion.response.clientDataJSON,
            authenticatorData: input.passkeyAssertion.response.authenticatorData,
            signature: input.passkeyAssertion.response.signature,
            expectedChallenge: challengePayload.challenge,
            expectedOrigin: cfg.origin,
            expectedRpId: cfg.rpId,
            credential: matched,
          });
          const updated = passkeys.map((p) =>
            p.credentialIdB64Url === matched.credentialIdB64Url ? { ...p, counter: newCounter } : p
          );
          await prisma.user.update({
            where: { id: user.id },
            data: { passkeyCredentials: updated as unknown as Prisma.InputJsonValue },
          });
          mfaSatisfied = true;
        } catch (err) {
          throw new AppError(
            'UNAUTHORIZED',
            err instanceof Error ? err.message : 'Passkey MFA verification failed'
          );
        }
      }

      if (!mfaSatisfied) {
        if (passkeys.length > 0 && !user.totpSecret) {
          throw new AppError('UNAUTHORIZED', 'Passkey MFA required');
        }
        throw new AppError(
          'UNAUTHORIZED',
          passkeys.length > 0 ? 'TOTP or Passkey MFA code required' : 'TOTP MFA code required'
        );
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
        totpSecret: true,
        passkeyCredentials: true,
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

    const passkeys = this.parsePasskeys(user.passkeyCredentials).map((p) => ({
      id: p.id,
      name: p.name,
      alg: p.alg,
      counter: p.counter,
      transports: p.transports ?? [],
      createdAt: p.createdAt,
    }));

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        mfaEnabled: user.mfaEnabled,
        hasTotp: Boolean(user.totpSecret),
        isSuperAdmin: user.isSuperAdmin,
        passkeys,
      },
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

  public async enablePasskeyMfa(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError('NOT_FOUND', 'User not found');
    const passkeys = this.parsePasskeys(user.passkeyCredentials);
    if (passkeys.length === 0) {
      throw new AppError(
        'VALIDATION_ERROR',
        'Register at least one passkey before enabling passkey MFA'
      );
    }
    await prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: true },
    });
    return { mfaEnabled: true };
  }

  // ---------------------------------------------------------------------------
  // WebAuthn Passkeys (Passwordless Sign-In + Passkey MFA)
  // ---------------------------------------------------------------------------
  public async listPasskeys(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { passkeyCredentials: true, mfaEnabled: true },
    });
    if (!user) throw new AppError('NOT_FOUND', 'User not found');
    return {
      mfaEnabled: user.mfaEnabled,
      passkeys: this.parsePasskeys(user.passkeyCredentials).map((p) => ({
        id: p.id,
        name: p.name,
        alg: p.alg,
        counter: p.counter,
        transports: p.transports ?? [],
        createdAt: p.createdAt,
      })),
    };
  }

  public async getPasskeyRegisterOptions(userId: string, requestOrigin?: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError('NOT_FOUND', 'User not found');

    const cfg = resolveWebAuthnConfig(requestOrigin);
    const challenge = randomBytes(32).toString('base64url');
    const challengeToken = signEphemeralToken(
      'webauthn_register',
      { userId: user.id, challenge },
      5 * 60 * 1000
    );

    const existing = this.parsePasskeys(user.passkeyCredentials);
    return {
      challengeToken,
      options: {
        challenge,
        rp: {
          id: cfg.rpId,
          name: cfg.rpName,
        },
        user: {
          id: Buffer.from(user.id, 'utf8').toString('base64url'),
          name: user.email,
          displayName: user.name || user.email,
        },
        pubKeyCredParams: [
          { type: 'public-key' as const, alg: -7 },
          { type: 'public-key' as const, alg: -257 },
        ],
        timeout: 60000,
        attestation: 'none' as const,
        excludeCredentials: existing.map((p) => ({
          id: p.credentialIdB64Url,
          type: 'public-key' as const,
          transports: p.transports,
        })),
        authenticatorSelection: {
          residentKey: 'preferred' as const,
          requireResidentKey: false,
          userVerification: 'preferred' as const,
        },
      },
    };
  }

  public async verifyPasskeyRegister(
    userId: string,
    input: PasskeyRegisterVerifyInput,
    requestOrigin?: string
  ) {
    const challengePayload = verifyEphemeralToken<{ userId: string; challenge: string }>(
      'webauthn_register',
      input.challengeToken
    );
    if (!challengePayload || challengePayload.userId !== userId) {
      throw new AppError('UNAUTHORIZED', 'Passkey registration challenge expired or invalid');
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError('NOT_FOUND', 'User not found');

    const cfg = resolveWebAuthnConfig(requestOrigin);
    let verified: ReturnType<typeof verifyPasskeyRegistration>;
    try {
      verified = verifyPasskeyRegistration({
        clientDataJSON: input.response.clientDataJSON,
        attestationObject: input.response.attestationObject,
        expectedChallenge: challengePayload.challenge,
        expectedOrigin: cfg.origin,
        expectedRpId: cfg.rpId,
      });
    } catch (err) {
      throw new AppError(
        'VALIDATION_ERROR',
        err instanceof Error ? err.message : 'Failed to verify passkey attestation'
      );
    }

    const existing = this.parsePasskeys(user.passkeyCredentials);
    if (existing.some((p) => p.credentialIdB64Url === verified.credentialIdB64Url)) {
      throw new AppError('CONFLICT', 'This passkey is already registered on your account');
    }

    const newCred: StoredPasskeyCredential = {
      id: verified.credentialIdB64Url,
      credentialIdB64Url: verified.credentialIdB64Url,
      publicKeyPem: verified.publicKeyPem,
      alg: verified.alg,
      counter: verified.counter,
      name: input.name?.trim() || 'Passkey',
      transports: input.transports ?? [],
      createdAt: new Date().toISOString(),
    };

    const next = [...existing, newCred];
    await prisma.user.update({
      where: { id: userId },
      data: {
        passkeyCredentials: next as unknown as Prisma.InputJsonValue,
      },
    });

    return {
      passkey: {
        id: newCred.id,
        name: newCred.name,
        alg: newCred.alg,
        counter: newCred.counter,
        transports: newCred.transports,
        createdAt: newCred.createdAt,
      },
    };
  }

  public async deletePasskey(userId: string, credentialId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError('NOT_FOUND', 'User not found');

    const existing = this.parsePasskeys(user.passkeyCredentials);
    const filtered = existing.filter(
      (p) => p.id !== credentialId && p.credentialIdB64Url !== credentialId
    );
    if (filtered.length === existing.length) {
      throw new AppError('NOT_FOUND', 'Passkey not found');
    }

    const disableMfa = filtered.length === 0 && !user.totpSecret;
    await prisma.user.update({
      where: { id: userId },
      data: {
        passkeyCredentials: filtered as unknown as Prisma.InputJsonValue,
        ...(disableMfa ? { mfaEnabled: false } : {}),
      },
    });

    return { removed: true, mfaEnabled: disableMfa ? false : user.mfaEnabled };
  }

  public async getPasskeyLoginOptions(email?: string, requestOrigin?: string) {
    const cfg = resolveWebAuthnConfig(requestOrigin);
    const challenge = randomBytes(32).toString('base64url');
    let userId: string | undefined;
    let allowCredentials: Array<{ id: string; type: 'public-key'; transports?: string[] }> = [];

    if (email && email.trim()) {
      const user = await prisma.user.findUnique({
        where: { email: email.trim().toLowerCase() },
        select: { id: true, passkeyCredentials: true },
      });
      if (user) {
        userId = user.id;
        allowCredentials = this.parsePasskeys(user.passkeyCredentials).map((p) => ({
          id: p.credentialIdB64Url,
          type: 'public-key' as const,
          transports: p.transports,
        }));
      }
    }

    const challengeToken = signEphemeralToken(
      'webauthn_login',
      { challenge, ...(userId ? { userId } : {}) },
      5 * 60 * 1000
    );

    return {
      challengeToken,
      options: {
        challenge,
        rpId: cfg.rpId,
        timeout: 60000,
        userVerification: 'preferred' as const,
        allowCredentials,
      },
    };
  }

  public async verifyPasskeyLogin(input: PasskeyLoginVerifyInput, requestOrigin?: string) {
    const challengePayload = verifyEphemeralToken<{ challenge: string; userId?: string }>(
      'webauthn_login',
      input.challengeToken
    );
    if (!challengePayload) {
      throw new AppError('UNAUTHORIZED', 'Passkey login challenge expired or invalid');
    }

    const credId = input.assertion.id || input.assertion.rawId;
    const candidates = challengePayload.userId
      ? await prisma.user.findMany({
          where: { id: challengePayload.userId },
          include: {
            memberships: {
              include: { family: true },
              orderBy: { createdAt: 'asc' },
            },
          },
        })
      : await prisma.user.findMany({
          include: {
            memberships: {
              include: { family: true },
              orderBy: { createdAt: 'asc' },
            },
          },
        });

    let matchedUser: (typeof candidates)[number] | null = null;
    let matchedCred: StoredPasskeyCredential | null = null;

    for (const candidate of candidates) {
      const passkeys = this.parsePasskeys(candidate.passkeyCredentials);
      const found = passkeys.find(
        (p) => p.credentialIdB64Url === credId || p.id === credId
      );
      if (found) {
        matchedUser = candidate;
        matchedCred = found;
        break;
      }
    }

    if (!matchedUser || !matchedCred) {
      throw new AppError('UNAUTHORIZED', 'Passkey is not registered to any Sure account');
    }

    const cfg = resolveWebAuthnConfig(requestOrigin);
    let newCounter = matchedCred.counter;
    try {
      const res = verifyPasskeyAuthentication({
        clientDataJSON: input.assertion.response.clientDataJSON,
        authenticatorData: input.assertion.response.authenticatorData,
        signature: input.assertion.response.signature,
        expectedChallenge: challengePayload.challenge,
        expectedOrigin: cfg.origin,
        expectedRpId: cfg.rpId,
        credential: matchedCred,
      });
      newCounter = res.newCounter;
    } catch (err) {
      throw new AppError(
        'UNAUTHORIZED',
        err instanceof Error ? err.message : 'Passkey signature verification failed'
      );
    }

    const updatedPasskeys = this.parsePasskeys(matchedUser.passkeyCredentials).map((p) =>
      p.credentialIdB64Url === matchedCred!.credentialIdB64Url ? { ...p, counter: newCounter } : p
    );
    await prisma.user.update({
      where: { id: matchedUser.id },
      data: { passkeyCredentials: updatedPasskeys as unknown as Prisma.InputJsonValue },
    });

    const membership = matchedUser.memberships[0];
    if (!membership) {
      throw new AppError('FORBIDDEN', 'User is not a member of any family workspace');
    }

    const role = membership.role as FamilyRole;
    const token = signSessionToken({
      userId: matchedUser.id,
      familyId: membership.familyId,
      role,
    });

    return {
      token,
      role,
      user: {
        id: matchedUser.id,
        email: matchedUser.email,
        name: matchedUser.name,
        mfaEnabled: matchedUser.mfaEnabled,
      },
      family: membership.family,
    };
  }

  // ---------------------------------------------------------------------------
  // Password Recovery (HMAC 15-min Single-Use Recovery Token + Optional Resend)
  // ---------------------------------------------------------------------------
  public async forgotPassword(input: ForgotPasswordInput) {
    const email = input.email.trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return {
        sent: true,
        delivery: env.RESEND_API_KEY ? 'email' : 'local',
        message: 'If an account with that email exists, recovery instructions have been sent.',
      };
    }

    const resetToken = signEphemeralToken(
      'password_reset',
      {
        userId: user.id,
        email: user.email,
        fp: passwordHashFingerprint(user.passwordHash),
      },
      15 * 60 * 1000
    );

    const resetUrl = `${env.CORS_ORIGIN}/?reset_token=${encodeURIComponent(resetToken)}`;

    if (env.RESEND_API_KEY) {
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: env.EMAIL_FROM,
            to: [user.email],
            subject: 'Sure Password Recovery',
            html: `<p>Use this link within 15 minutes to reset your Sure password:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>Or paste this token: <code>${resetToken}</code></p>`,
          }),
        });
      } catch {
        // Do not leak delivery errors externally
      }
    }

    return {
      sent: true,
      delivery: env.RESEND_API_KEY ? 'email' : 'local',
      message: env.RESEND_API_KEY
        ? 'Recovery link sent to your email address.'
        : 'Recovery token generated (15-minute expiry). Use the token below to reset your password.',
      ...(env.NODE_ENV !== 'production' && !env.RESEND_API_KEY ? { devResetToken: resetToken } : {}),
    };
  }

  public async resetPassword(input: ResetPasswordInput) {
    const payload = verifyEphemeralToken<{ userId: string; email: string; fp: string }>(
      'password_reset',
      input.token.trim()
    );
    if (!payload) {
      throw new AppError('UNAUTHORIZED', 'Password recovery token is invalid or expired');
    }

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user || passwordHashFingerprint(user.passwordHash) !== payload.fp) {
      throw new AppError('UNAUTHORIZED', 'Password recovery token has already been used');
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: hashPassword(input.newPassword) },
    });

    return { reset: true };
  }

  // ---------------------------------------------------------------------------
  // OAuth 2.0 + PKCE (Google & GitHub)
  // ---------------------------------------------------------------------------
  private getRedirectUri(provider: 'google' | 'github', requestOrigin?: string): string {
    const base = (env.OAUTH_REDIRECT_BASE_URL || requestOrigin || env.CORS_ORIGIN || 'http://localhost:5173').replace(
      /\/$/,
      ''
    );
    return `${base}/api/v1/auth/oauth/${provider}/callback`;
  }

  public getAuthProviders(requestOrigin?: string) {
    return {
      google: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
      github: Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET),
      passkeys: true,
      passwordRecovery: true,
      googleRedirectUri: this.getRedirectUri('google', requestOrigin),
      githubRedirectUri: this.getRedirectUri('github', requestOrigin),
    };
  }

  public startOAuth(provider: 'google' | 'github', requestOrigin?: string): { authorizeUrl: string } {
    const redirectUri = this.getRedirectUri(provider, requestOrigin);
    const { codeVerifier, codeChallenge } = createPkcePair();
    const state = signEphemeralToken(
      'oauth_state',
      { provider, codeVerifier, redirectUri },
      10 * 60 * 1000
    );

    if (provider === 'google') {
      if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
        throw new AppError(
          'VALIDATION_ERROR',
          'Google OAuth is not configured yet. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.'
        );
      }
      const params = new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid email profile',
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        state,
        access_type: 'online',
        prompt: 'select_account',
      });
      return { authorizeUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` };
    }

    if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
      throw new AppError(
        'VALIDATION_ERROR',
        'GitHub OAuth is not configured yet. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in .env.'
      );
    }
    const params = new URLSearchParams({
      client_id: env.GITHUB_CLIENT_ID,
      redirect_uri: redirectUri,
      scope: 'read:user user:email',
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      state,
    });
    return { authorizeUrl: `https://github.com/login/oauth/authorize?${params.toString()}` };
  }

  public async completeOAuthCallback(
    provider: 'google' | 'github',
    code: string,
    stateToken: string
  ) {
    const state = verifyEphemeralToken<{
      provider: string;
      codeVerifier: string;
      redirectUri: string;
    }>('oauth_state', stateToken);

    if (!state || state.provider !== provider) {
      throw new AppError('UNAUTHORIZED', 'OAuth state expired or invalid');
    }

    let email = '';
    let name = '';

    if (provider === 'google') {
      if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
        throw new AppError('VALIDATION_ERROR', 'Google OAuth credentials missing');
      }
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: env.GOOGLE_CLIENT_ID,
          client_secret: env.GOOGLE_CLIENT_SECRET,
          code,
          code_verifier: state.codeVerifier,
          grant_type: 'authorization_code',
          redirect_uri: state.redirectUri,
        }),
      });
      if (!tokenRes.ok) {
        throw new AppError('UNAUTHORIZED', 'Google OAuth token exchange failed');
      }
      const tokenJson = (await tokenRes.json()) as { access_token?: string };
      if (!tokenJson.access_token) {
        throw new AppError('UNAUTHORIZED', 'Missing Google access token');
      }
      const profileRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
        headers: { Authorization: `Bearer ${tokenJson.access_token}` },
      });
      if (!profileRes.ok) {
        throw new AppError('UNAUTHORIZED', 'Failed to fetch Google user profile');
      }
      const profile = (await profileRes.json()) as {
        email?: string;
        email_verified?: boolean;
        name?: string;
      };
      if (!profile.email || profile.email_verified === false) {
        throw new AppError('UNAUTHORIZED', 'Verified Google email address is required');
      }
      email = profile.email.trim().toLowerCase();
      name = profile.name?.trim() || email.split('@')[0] || 'Sure User';
    } else {
      if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
        throw new AppError('VALIDATION_ERROR', 'GitHub OAuth credentials missing');
      }
      const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: env.GITHUB_CLIENT_ID,
          client_secret: env.GITHUB_CLIENT_SECRET,
          code,
          code_verifier: state.codeVerifier,
          redirect_uri: state.redirectUri,
        }),
      });
      if (!tokenRes.ok) {
        throw new AppError('UNAUTHORIZED', 'GitHub OAuth token exchange failed');
      }
      const tokenJson = (await tokenRes.json()) as { access_token?: string };
      if (!tokenJson.access_token) {
        throw new AppError('UNAUTHORIZED', 'Missing GitHub access token');
      }
      const ghHeaders = {
        Authorization: `Bearer ${tokenJson.access_token}`,
        Accept: 'application/vnd.github+json',
      };
      const userRes = await fetch('https://api.github.com/user', { headers: ghHeaders });
      const ghUser = (await userRes.json()) as { email?: string; name?: string; login?: string };
      const emailsRes = await fetch('https://api.github.com/user/emails', { headers: ghHeaders });
      const ghEmails = emailsRes.ok
        ? ((await emailsRes.json()) as Array<{ email: string; primary: boolean; verified: boolean }>)
        : [];
      const primaryVerified =
        ghEmails.find((e) => e.primary && e.verified) ?? ghEmails.find((e) => e.verified);
      email = (primaryVerified?.email || ghUser.email || '').trim().toLowerCase();
      if (!email) {
        throw new AppError('UNAUTHORIZED', 'GitHub account does not expose a verified email');
      }
      name = ghUser.name?.trim() || ghUser.login || email.split('@')[0] || 'Sure User';
    }

    let existingUser = await prisma.user.findUnique({
      where: { email },
      include: {
        memberships: {
          include: { family: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!existingUser) {
      const randomSecret = randomBytes(32).toString('hex');
      const created = await prisma.$transaction(async (tx) => {
        const createdUser = await tx.user.create({
          data: {
            email,
            passwordHash: hashPassword(randomSecret),
            name,
            emailVerifiedAt: new Date(),
          },
        });
        const family = await tx.family.create({
          data: {
            name: `${name}'s Household`,
            baseCurrency: 'IDR',
          },
        });
        await tx.familyMembership.create({
          data: {
            familyId: family.id,
            userId: createdUser.id,
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
        return { user: createdUser, family };
      });

      const token = signSessionToken({
        userId: created.user.id,
        familyId: created.family.id,
        role: 'OWNER',
      });
      return { token };
    }

    const membership = existingUser.memberships[0];
    if (!membership) {
      throw new AppError('FORBIDDEN', 'User is not a member of any family workspace');
    }

    const token = signSessionToken({
      userId: existingUser.id,
      familyId: membership.familyId,
      role: membership.role as FamilyRole,
    });
    return { token };
  }
}

export const authService = new AuthService();
