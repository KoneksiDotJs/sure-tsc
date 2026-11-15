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
  verifyEphemeralToken,
  verifyPassword,
  verifyTotpCode,
} from '../../config/crypto.js';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../middleware/pipeline.js';
import { authMfaKeysService } from './auth.mfa-keys.service.js';
import { authOAuthService } from './auth.oauth.service.js';
import { authPasskeyService } from './auth.passkey.service.js';
import { authRecoveryService } from './auth.recovery.service.js';
import {
  buildAuthSessionResponse,
  parsePasskeys,
  provisionUserWithFamily,
} from './auth.shared.js';
import {
  resolveWebAuthnConfig,
  verifyPasskeyAuthentication,
} from './webauthn.js';

export class AuthService {
  public async register(input: RegisterInput) {
    const email = input.email.trim().toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new AppError('CONFLICT', 'An account with this email already exists');
    }

    const created = await provisionUserWithFamily({
      email,
      password: input.password,
      name: input.name.trim(),
      familyName: input.familyName.trim(),
      baseCurrency: input.baseCurrency,
    });

    return buildAuthSessionResponse(created.user, created.family, 'OWNER');
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

    const passkeys = parsePasskeys(user.passkeyCredentials);
    if (user.mfaEnabled) {
      await this.verifyLoginMfaChallenge(user, passkeys, input, requestOrigin);
    }

    const membership = user.memberships[0];
    if (!membership) {
      throw new AppError('FORBIDDEN', 'User is not a member of any family workspace');
    }

    return buildAuthSessionResponse(user, membership.family, membership.role as FamilyRole);
  }

  private async verifyLoginMfaChallenge(
    user: { id: string; totpSecret: string | null },
    passkeys: ReturnType<typeof parsePasskeys>,
    input: LoginInput,
    requestOrigin?: string
  ) {
    if (input.totpCode) {
      if (!user.totpSecret || !verifyTotpCode(user.totpSecret, input.totpCode)) {
        throw new AppError('UNAUTHORIZED', 'Invalid TOTP MFA code');
      }
      return;
    }

    if (input.passkeyAssertion && input.challengeToken) {
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
        return;
      } catch (err) {
        throw new AppError(
          'UNAUTHORIZED',
          err instanceof Error ? err.message : 'Passkey MFA verification failed'
        );
      }
    }

    if (passkeys.length > 0 && !user.totpSecret) {
      throw new AppError('UNAUTHORIZED', 'Passkey MFA required');
    }
    throw new AppError(
      'UNAUTHORIZED',
      passkeys.length > 0 ? 'TOTP or Passkey MFA code required' : 'TOTP MFA code required'
    );
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
    const family = await prisma.family.findUnique({ where: { id: familyId } });

    if (!user || !family) {
      throw new AppError('UNAUTHORIZED', 'Session is no longer valid');
    }

    const [memberships, apiKeys] = await Promise.all([
      prisma.familyMembership.findMany({
        where: { familyId },
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'asc' },
      }),
      authMfaKeysService.listApiKeys(familyId),
    ]);

    const passkeys = parsePasskeys(user.passkeyCredentials).map((p) => ({
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

  // MFA & API Keys
  public setupMfa = (userId: string) => authMfaKeysService.setupMfa(userId);
  public enableMfa = (userId: string, totpCode: string) =>
    authMfaKeysService.enableMfa(userId, totpCode);
  public disableMfa = (userId: string) => authMfaKeysService.disableMfa(userId);
  public listApiKeys = (familyId: string) => authMfaKeysService.listApiKeys(familyId);
  public createApiKey = (familyId: string, userId: string, input: CreateApiKeyInput) =>
    authMfaKeysService.createApiKey(familyId, userId, input);
  public deleteApiKey = (familyId: string, keyId: string) =>
    authMfaKeysService.deleteApiKey(familyId, keyId);
  public changePassword = (userId: string, currentPassword: string, newPassword: string) =>
    authMfaKeysService.changePassword(userId, currentPassword, newPassword);

  // WebAuthn Passkeys
  public enablePasskeyMfa = (userId: string) => authPasskeyService.enablePasskeyMfa(userId);
  public listPasskeys = (userId: string) => authPasskeyService.listPasskeys(userId);
  public getPasskeyRegisterOptions = (userId: string, requestOrigin?: string) =>
    authPasskeyService.getPasskeyRegisterOptions(userId, requestOrigin);
  public verifyPasskeyRegister = (
    userId: string,
    input: PasskeyRegisterVerifyInput,
    requestOrigin?: string
  ) => authPasskeyService.verifyPasskeyRegister(userId, input, requestOrigin);
  public deletePasskey = (userId: string, credentialId: string) =>
    authPasskeyService.deletePasskey(userId, credentialId);
  public getPasskeyLoginOptions = (email?: string, requestOrigin?: string) =>
    authPasskeyService.getPasskeyLoginOptions(email, requestOrigin);
  public verifyPasskeyLogin = (input: PasskeyLoginVerifyInput, requestOrigin?: string) =>
    authPasskeyService.verifyPasskeyLogin(input, requestOrigin);

  // Password Recovery
  public forgotPassword = (input: ForgotPasswordInput) => authRecoveryService.forgotPassword(input);
  public resetPassword = (input: ResetPasswordInput) => authRecoveryService.resetPassword(input);

  // OAuth 2.0 + PKCE
  public getAuthProviders = (requestOrigin?: string) =>
    authOAuthService.getAuthProviders(requestOrigin);
  public startOAuth = (provider: 'google' | 'github', requestOrigin?: string) =>
    authOAuthService.startOAuth(provider, requestOrigin);
  public completeOAuthCallback = (provider: 'google' | 'github', code: string, stateToken: string) =>
    authOAuthService.completeOAuthCallback(provider, code, stateToken);
}

export const authService = new AuthService();
