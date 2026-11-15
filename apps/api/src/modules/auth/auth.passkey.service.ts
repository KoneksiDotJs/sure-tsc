import { randomBytes } from 'node:crypto';
import { Prisma } from '@prisma/client';
import {
  FamilyRole,
  PasskeyLoginVerifyInput,
  PasskeyRegisterVerifyInput,
} from '@sure/shared';
import { signEphemeralToken, verifyEphemeralToken } from '../../config/crypto.js';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../middleware/pipeline.js';
import { buildAuthSessionResponse, parsePasskeys } from './auth.shared.js';
import {
  resolveWebAuthnConfig,
  StoredPasskeyCredential,
  verifyPasskeyAuthentication,
  verifyPasskeyRegistration,
} from './webauthn.js';

export class AuthPasskeyService {
  public async enablePasskeyMfa(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError('NOT_FOUND', 'User not found');
    const passkeys = parsePasskeys(user.passkeyCredentials);
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

  public async listPasskeys(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { passkeyCredentials: true, mfaEnabled: true },
    });
    if (!user) throw new AppError('NOT_FOUND', 'User not found');
    return {
      mfaEnabled: user.mfaEnabled,
      passkeys: parsePasskeys(user.passkeyCredentials).map((p) => ({
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

    const existing = parsePasskeys(user.passkeyCredentials);
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

    const existing = parsePasskeys(user.passkeyCredentials);
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

    const existing = parsePasskeys(user.passkeyCredentials);
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
        allowCredentials = parsePasskeys(user.passkeyCredentials).map((p) => ({
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
    const candidates = await prisma.user.findMany({
      where: challengePayload.userId ? { id: challengePayload.userId } : undefined,
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
      const passkeys = parsePasskeys(candidate.passkeyCredentials);
      const found = passkeys.find((p) => p.credentialIdB64Url === credId || p.id === credId);
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

    const updatedPasskeys = parsePasskeys(matchedUser.passkeyCredentials).map((p) =>
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

    return buildAuthSessionResponse(matchedUser, membership.family, membership.role as FamilyRole);
  }
}

export const authPasskeyService = new AuthPasskeyService();
