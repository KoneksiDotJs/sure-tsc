import { createHash, createSign, generateKeyPairSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  createPkcePair,
  decryptSecret,
  encryptSecret,
  hashPassword,
  passwordHashFingerprint,
  signEphemeralToken,
  verifyEphemeralToken,
} from '../../config/crypto.js';
import {
  fetchProviderModels,
  getSafeAiConfigForFamily,
  resolveAiRuntimeConfig,
  updateFamilyAiConfig,
} from '../ai/ai.providers.js';
import { verifyPasskeyAuthentication, verifyPasskeyRegistration } from './webauthn.js';

function cborMapHeader(count: number): Buffer {
  return Buffer.from([0xa0 | count]);
}

function cborText(str: string): Buffer {
  const b = Buffer.from(str, 'utf8');
  return Buffer.concat([Buffer.from([0x60 | b.length]), b]);
}

function cborBytes(buf: Buffer): Buffer {
  if (buf.length < 24) {
    return Buffer.concat([Buffer.from([0x40 | buf.length]), buf]);
  }
  return Buffer.concat([Buffer.from([0x58, buf.length]), buf]);
}

function cborInt(val: number): Buffer {
  if (val >= 0 && val < 24) return Buffer.from([val]);
  if (val < 0 && -1 - val < 24) return Buffer.from([0x20 | (-1 - val)]);
  throw new Error(`Unsupported test CBOR int: ${val}`);
}

describe('Auth Crypto, WebAuthn Passkeys, PKCE & Free AI Config', () => {
  it('signs and verifies single-use ephemeral recovery & PKCE tokens cleanly', () => {
    const { codeVerifier, codeChallenge } = createPkcePair();
    expect(codeVerifier.length).toBeGreaterThanOrEqual(32);
    expect(codeChallenge).toBe(createHash('sha256').update(codeVerifier).digest('base64url'));

    const hashA = hashPassword('OldPassword1!');
    const fpA = passwordHashFingerprint(hashA);
    const token = signEphemeralToken('password_reset', { userId: 'u-1', fp: fpA }, 60_000);

    const verified = verifyEphemeralToken<{ userId: string; fp: string }>('password_reset', token);
    expect(verified?.userId).toBe('u-1');
    expect(verified?.fp).toBe(fpA);

    // Purpose isolation
    expect(verifyEphemeralToken('oauth_state', token)).toBeNull();

    // Password change rotates fingerprint so token becomes stale
    const hashB = hashPassword('NewPassword2!');
    expect(passwordHashFingerprint(hashB)).not.toBe(fpA);
  });

  it('encrypts and decrypts AI API secrets with AES-256-GCM', () => {
    const rawKey = 'gsk_test_free_tier_key_987654321';
    const encrypted = encryptSecret(rawKey);
    expect(encrypted).not.toContain(rawKey);
    expect(decryptSecret(encrypted)).toBe(rawKey);
    expect(decryptSecret('invalid.cipher.payload')).toBeNull();
  });

  it('verifies EC2 P-256 WebAuthn registration attestation and subsequent sign-in assertion', () => {
    const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const jwk = publicKey.export({ format: 'jwk' }) as { x: string; y: string };
    const xBuf = Buffer.from(jwk.x, 'base64url');
    const yBuf = Buffer.from(jwk.y, 'base64url');

    // COSE EC2 P-256 map: { 1: 2, 3: -7, -1: 1, -2: x, -3: y }
    const coseKeyCbor = Buffer.concat([
      cborMapHeader(5),
      cborInt(1),
      cborInt(2),
      cborInt(3),
      cborInt(-7),
      cborInt(-1),
      cborInt(1),
      cborInt(-2),
      cborBytes(xBuf),
      cborInt(-3),
      cborBytes(yBuf),
    ]);

    const rpId = 'localhost';
    const origin = 'http://localhost:5173';
    const rpIdHash = createHash('sha256').update(rpId).digest();
    const credId = Buffer.from('test-passkey-credential-id-01');
    const credIdLen = Buffer.alloc(2);
    credIdLen.writeUInt16BE(credId.length);

    const regAuthData = Buffer.concat([
      rpIdHash,
      Buffer.from([0x45]), // UP (0x01) + UV (0x04) + AT (0x40)
      Buffer.from([0, 0, 0, 1]), // counter = 1
      Buffer.alloc(16), // AAGUID
      credIdLen,
      credId,
      coseKeyCbor,
    ]);

    const attestationObject = Buffer.concat([
      cborMapHeader(2),
      cborText('fmt'),
      cborText('none'),
      cborText('authData'),
      cborBytes(regAuthData),
    ]).toString('base64url');

    const regChallenge = 'reg-challenge-xyz';
    const regClientData = Buffer.from(
      JSON.stringify({ type: 'webauthn.create', challenge: regChallenge, origin })
    ).toString('base64url');

    const registered = verifyPasskeyRegistration({
      clientDataJSON: regClientData,
      attestationObject,
      expectedChallenge: regChallenge,
      expectedOrigin: origin,
      expectedRpId: rpId,
    });

    expect(registered.credentialIdB64Url).toBe(credId.toString('base64url'));
    expect(registered.alg).toBe(-7);
    expect(registered.counter).toBe(1);

    // Assertion verification (counter = 2)
    const loginChallenge = 'login-challenge-abc';
    const loginClientData = Buffer.from(
      JSON.stringify({ type: 'webauthn.get', challenge: loginChallenge, origin })
    ).toString('base64url');
    const assertionAuthData = Buffer.concat([
      rpIdHash,
      Buffer.from([0x05]), // UP + UV
      Buffer.from([0, 0, 0, 2]), // counter = 2
    ]);
    const clientDataHash = createHash('sha256')
      .update(Buffer.from(loginClientData, 'base64url'))
      .digest();
    const signer = createSign('SHA256');
    signer.update(Buffer.concat([assertionAuthData, clientDataHash]));
    const signature = signer.sign(privateKey).toString('base64url');

    const credentialRecord = {
      id: registered.credentialIdB64Url,
      credentialIdB64Url: registered.credentialIdB64Url,
      publicKeyPem: registered.publicKeyPem,
      alg: registered.alg,
      counter: registered.counter,
      name: 'Test Key',
      createdAt: new Date().toISOString(),
    };

    const verifiedAuth = verifyPasskeyAuthentication({
      clientDataJSON: loginClientData,
      authenticatorData: assertionAuthData.toString('base64url'),
      signature,
      expectedChallenge: loginChallenge,
      expectedOrigin: origin,
      expectedRpId: rpId,
      credential: credentialRecord,
    });
    expect(verifiedAuth.newCounter).toBe(2);

    // Cloned counter replay (counter <= stored counter 2) should reject
    expect(() =>
      verifyPasskeyAuthentication({
        clientDataJSON: loginClientData,
        authenticatorData: assertionAuthData.toString('base64url'),
        signature,
        expectedChallenge: loginChallenge,
        expectedOrigin: origin,
        expectedRpId: rpId,
        credential: { ...credentialRecord, counter: 2 },
      })
    ).toThrow(/counter/i);
  });

  it('stores and resolves free AI service configuration safely per family', () => {
    const testFamilyId = 'test-family-free-ai-spec';
    const updated = updateFamilyAiConfig(testFamilyId, {
      provider: 'groq',
      apiKey: 'gsk_free_demo_secret_1234',
      model: 'llama-3.3-70b-versatile',
    });

    expect(updated.resolvedProvider).toBe('groq');
    expect(updated.hasApiKey).toBe(true);
    expect(updated.maskedKey).toBe('gsk_••••1234');
    expect(JSON.stringify(updated)).not.toContain('gsk_free_demo_secret_1234');

    const runtime = resolveAiRuntimeConfig(testFamilyId);
    expect(runtime.endpointUrl).toBe('https://api.groq.com/openai/v1/chat/completions');
    expect(runtime.apiKey).toBe('gsk_free_demo_secret_1234');

    const overridden = resolveAiRuntimeConfig(testFamilyId, {
      provider: 'openrouter',
      apiKey: 'sk-or-test-override',
      model: 'nvidia/nemotron-3-ultra-550b-a55b:free',
    });
    expect(overridden.provider).toBe('openrouter');
    expect(overridden.endpointUrl).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(overridden.apiKey).toBe('sk-or-test-override');
    expect(overridden.model).toBe('nvidia/nemotron-3-ultra-550b-a55b:free');

    const cleared = updateFamilyAiConfig(testFamilyId, {
      provider: 'gemini',
      clearApiKey: true,
    });
    expect(getSafeAiConfigForFamily(testFamilyId).resolvedProvider).toBe('gemini');
    expect(cleared.hasApiKey).toBe(false);
  });

  it('lists models for any selected provider with fallback curation and custom model preservation', async () => {
    const geminiList = await fetchProviderModels('test-models-family', {
      provider: 'gemini',
      model: 'gemini-2.0-flash-thinking-exp',
    });
    expect(geminiList.provider).toBe('gemini');
    expect(geminiList.models.length).toBeGreaterThanOrEqual(4);
    expect(geminiList.models[0]?.id).toBe('gemini-2.0-flash-thinking-exp');
  });
});
