import { createHash, createPublicKey, createVerify } from 'node:crypto';
import { env } from '../../config/env.js';

export interface StoredPasskeyCredential {
  id: string;
  credentialIdB64Url: string;
  publicKeyPem: string;
  alg: number;
  counter: number;
  name: string;
  transports?: string[];
  createdAt: string;
}

export function resolveWebAuthnConfig(requestOrigin?: string): {
  rpId: string;
  rpName: string;
  origin: string;
} {
  const origin = env.WEBAUTHN_ORIGIN || requestOrigin || env.CORS_ORIGIN || 'http://localhost:5173';
  let hostname = 'localhost';
  try {
    hostname = new URL(origin).hostname;
  } catch {
    hostname = 'localhost';
  }
  return {
    rpId: env.WEBAUTHN_RP_ID || hostname,
    rpName: env.WEBAUTHN_RP_NAME || 'Sure',
    origin,
  };
}

// ---------------------------------------------------------------------------
// Minimal RFC 8949 CBOR decoder supporting WebAuthn attestation & COSE keys
// ---------------------------------------------------------------------------
function readUint(buf: Buffer, offset: number, addInfo: number): [number, number] {
  if (addInfo < 24) return [addInfo, offset];
  if (addInfo === 24) return [buf.readUInt8(offset), offset + 1];
  if (addInfo === 25) return [buf.readUInt16BE(offset), offset + 2];
  if (addInfo === 26) return [buf.readUInt32BE(offset), offset + 4];
  if (addInfo === 27) return [Number(buf.readBigUInt64BE(offset)), offset + 8];
  throw new Error(`Unsupported CBOR additional info: ${addInfo}`);
}

export function decodeCborValue(buf: Buffer, offset = 0): [unknown, number] {
  if (offset >= buf.length) throw new Error('Unexpected end of CBOR buffer');
  const initial = buf[offset++]!;
  const major = initial >> 5;
  const addInfo = initial & 0x1f;

  if (major === 0) {
    const [val, next] = readUint(buf, offset, addInfo);
    return [val, next];
  }
  if (major === 1) {
    const [val, next] = readUint(buf, offset, addInfo);
    return [-1 - val, next];
  }
  if (major === 2) {
    const [len, start] = readUint(buf, offset, addInfo);
    return [buf.subarray(start, start + len), start + len];
  }
  if (major === 3) {
    const [len, start] = readUint(buf, offset, addInfo);
    return [buf.subarray(start, start + len).toString('utf8'), start + len];
  }
  if (major === 4) {
    const [len, start] = readUint(buf, offset, addInfo);
    const arr: unknown[] = [];
    let pos = start;
    for (let i = 0; i < len; i += 1) {
      const [item, next] = decodeCborValue(buf, pos);
      arr.push(item);
      pos = next;
    }
    return [arr, pos];
  }
  if (major === 5) {
    const [len, start] = readUint(buf, offset, addInfo);
    const map = new Map<unknown, unknown>();
    let pos = start;
    for (let i = 0; i < len; i += 1) {
      const [k, kNext] = decodeCborValue(buf, pos);
      const [v, vNext] = decodeCborValue(buf, kNext);
      map.set(k, v);
      pos = vNext;
    }
    return [map, pos];
  }
  if (major === 6) {
    const [, start] = readUint(buf, offset, addInfo);
    return decodeCborValue(buf, start);
  }
  if (major === 7) {
    if (addInfo === 20) return [false, offset];
    if (addInfo === 21) return [true, offset];
    if (addInfo === 22 || addInfo === 23) return [null, offset];
    if (addInfo === 25) return [buf.readFloatBE(offset), offset + 2];
    if (addInfo === 26) return [buf.readFloatBE(offset), offset + 4];
    if (addInfo === 27) return [buf.readDoubleBE(offset), offset + 8];
  }
  throw new Error(`Unsupported CBOR major type ${major}`);
}

function derLength(len: number): Buffer {
  if (len < 0x80) return Buffer.from([len]);
  const bytes: number[] = [];
  let n = len;
  while (n > 0) {
    bytes.unshift(n & 0xff);
    n >>= 8;
  }
  return Buffer.from([0x80 | bytes.length, ...bytes]);
}

function derInteger(buf: Buffer): Buffer {
  let out = buf;
  while (out.length > 1 && out[0] === 0 && (out[1]! & 0x80) === 0) {
    out = out.subarray(1);
  }
  if (out[0]! & 0x80) {
    out = Buffer.concat([Buffer.from([0x00]), out]);
  }
  return Buffer.concat([Buffer.from([0x02]), derLength(out.length), out]);
}

function derSequence(parts: Buffer[]): Buffer {
  const body = Buffer.concat(parts);
  return Buffer.concat([Buffer.from([0x30]), derLength(body.length), body]);
}

export function coseKeyToSpkiPem(coseMap: Map<unknown, unknown>): { pem: string; alg: number } {
  const kty = coseMap.get(1);
  const alg = coseMap.get(3);

  // EC2 P-256 (ES256, alg = -7)
  if (kty === 2 && coseMap.get(-1) === 1) {
    const x = coseMap.get(-2);
    const y = coseMap.get(-3);
    if (!Buffer.isBuffer(x) || !Buffer.isBuffer(y)) {
      throw new Error('Invalid EC2 COSE key coordinates');
    }
    const xPad = x.length === 32 ? x : Buffer.concat([Buffer.alloc(32 - x.length), x]);
    const yPad = y.length === 32 ? y : Buffer.concat([Buffer.alloc(32 - y.length), y]);
    const uncompressedPoint = Buffer.concat([Buffer.from([0x04]), xPad, yPad]);
    const ecSpkiPrefix = Buffer.from(
      '3059301306072a8648ce3d020106082a8648ce3d030107034200',
      'hex'
    );
    const spki = Buffer.concat([ecSpkiPrefix, uncompressedPoint]);
    const keyObj = createPublicKey({ key: spki, format: 'der', type: 'spki' });
    return {
      pem: keyObj.export({ format: 'pem', type: 'spki' }).toString(),
      alg: typeof alg === 'number' ? alg : -7,
    };
  }

  // RSA (RS256, alg = -257)
  if (kty === 3) {
    const n = coseMap.get(-1);
    const e = coseMap.get(-2);
    if (!Buffer.isBuffer(n) || !Buffer.isBuffer(e)) {
      throw new Error('Invalid RSA COSE key');
    }
    const rsaPub = derSequence([derInteger(n), derInteger(e)]);
    const rsaAlgId = Buffer.from('300d06092a864886f70d0101010500', 'hex');
    const bitString = Buffer.concat([
      Buffer.from([0x03]),
      derLength(rsaPub.length + 1),
      Buffer.from([0x00]),
      rsaPub,
    ]);
    const spki = derSequence([rsaAlgId, bitString]);
    const keyObj = createPublicKey({ key: spki, format: 'der', type: 'spki' });
    return {
      pem: keyObj.export({ format: 'pem', type: 'spki' }).toString(),
      alg: typeof alg === 'number' ? alg : -257,
    };
  }

  throw new Error(`Unsupported WebAuthn COSE key type: kty=${String(kty)}, alg=${String(alg)}`);
}

export interface ParsedAuthData {
  rpIdHash: Buffer;
  flags: number;
  signCount: number;
  credentialIdB64Url?: string;
  publicKeyPem?: string;
  alg?: number;
}

export function parseAuthenticatorData(authData: Buffer): ParsedAuthData {
  if (authData.length < 37) {
    throw new Error('WebAuthn authenticatorData too short');
  }
  const rpIdHash = authData.subarray(0, 32);
  const flags = authData[32]!;
  const signCount = authData.readUInt32BE(33);

  const hasAttestedCredentialData = (flags & 0x40) !== 0;
  if (!hasAttestedCredentialData) {
    return { rpIdHash, flags, signCount };
  }

  let offset = 37;
  offset += 16; // skip AAGUID
  const credIdLen = authData.readUInt16BE(offset);
  offset += 2;
  const credIdBuf = authData.subarray(offset, offset + credIdLen);
  offset += credIdLen;
  const [coseDecoded] = decodeCborValue(authData.subarray(offset), 0);
  if (!(coseDecoded instanceof Map)) {
    throw new Error('Invalid COSE public key map in attestationObject');
  }
  const { pem, alg } = coseKeyToSpkiPem(coseDecoded);

  return {
    rpIdHash,
    flags,
    signCount,
    credentialIdB64Url: credIdBuf.toString('base64url'),
    publicKeyPem: pem,
    alg,
  };
}

function assertClientData(
  clientDataB64Url: string,
  expectedType: 'webauthn.create' | 'webauthn.get',
  expectedChallenge: string,
  expectedOrigin: string
): Buffer {
  const clientDataRaw = Buffer.from(clientDataB64Url, 'base64url');
  const parsed = JSON.parse(clientDataRaw.toString('utf8')) as {
    type?: string;
    challenge?: string;
    origin?: string;
  };
  if (parsed.type !== expectedType) {
    throw new Error(`Unexpected WebAuthn clientData type: ${parsed.type}`);
  }
  if (parsed.challenge !== expectedChallenge) {
    throw new Error('WebAuthn challenge mismatch');
  }
  if (parsed.origin && parsed.origin !== expectedOrigin) {
    // Allow localhost vs 127.0.0.1 in non-production dev when both share loopback
    const isDevLoopback =
      env.NODE_ENV !== 'production' &&
      /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(parsed.origin) &&
      /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(expectedOrigin);
    if (!isDevLoopback) {
      throw new Error(`WebAuthn origin mismatch: expected ${expectedOrigin}, got ${parsed.origin}`);
    }
  }
  return clientDataRaw;
}

export function verifyPasskeyRegistration(params: {
  clientDataJSON: string;
  attestationObject: string;
  expectedChallenge: string;
  expectedOrigin: string;
  expectedRpId: string;
}): {
  credentialIdB64Url: string;
  publicKeyPem: string;
  alg: number;
  counter: number;
} {
  assertClientData(
    params.clientDataJSON,
    'webauthn.create',
    params.expectedChallenge,
    params.expectedOrigin
  );

  const attBuf = Buffer.from(params.attestationObject, 'base64url');
  const [attMap] = decodeCborValue(attBuf, 0);
  if (!(attMap instanceof Map)) {
    throw new Error('Invalid attestationObject CBOR map');
  }
  const authData = attMap.get('authData');
  if (!Buffer.isBuffer(authData)) {
    throw new Error('Missing authData in attestationObject');
  }

  const parsed = parseAuthenticatorData(authData);
  const expectedRpIdHash = createHash('sha256').update(params.expectedRpId).digest();
  if (!parsed.rpIdHash.equals(expectedRpIdHash)) {
    throw new Error('WebAuthn RP ID hash mismatch');
  }
  if ((parsed.flags & 0x01) === 0) {
    throw new Error('WebAuthn User Present flag not set');
  }
  if (!parsed.credentialIdB64Url || !parsed.publicKeyPem || typeof parsed.alg !== 'number') {
    throw new Error('Missing attested credential data during passkey registration');
  }

  return {
    credentialIdB64Url: parsed.credentialIdB64Url,
    publicKeyPem: parsed.publicKeyPem,
    alg: parsed.alg,
    counter: parsed.signCount,
  };
}

export function verifyPasskeyAuthentication(params: {
  clientDataJSON: string;
  authenticatorData: string;
  signature: string;
  expectedChallenge: string;
  expectedOrigin: string;
  expectedRpId: string;
  credential: StoredPasskeyCredential;
}): { newCounter: number } {
  const clientDataRaw = assertClientData(
    params.clientDataJSON,
    'webauthn.get',
    params.expectedChallenge,
    params.expectedOrigin
  );
  const authDataBuf = Buffer.from(params.authenticatorData, 'base64url');
  const parsed = parseAuthenticatorData(authDataBuf);

  const expectedRpIdHash = createHash('sha256').update(params.expectedRpId).digest();
  if (!parsed.rpIdHash.equals(expectedRpIdHash)) {
    throw new Error('WebAuthn RP ID hash mismatch');
  }
  if ((parsed.flags & 0x01) === 0) {
    throw new Error('WebAuthn User Present flag not set');
  }

  const clientDataHash = createHash('sha256').update(clientDataRaw).digest();
  const signedPayload = Buffer.concat([authDataBuf, clientDataHash]);
  const signatureBuf = Buffer.from(params.signature, 'base64url');

  const verifier = createVerify('SHA256');
  verifier.update(signedPayload);
  verifier.end();
  const ok = verifier.verify(params.credential.publicKeyPem, signatureBuf);
  if (!ok) {
    throw new Error('Invalid WebAuthn passkey signature');
  }

  if (parsed.signCount > 0 && params.credential.counter > 0 && parsed.signCount <= params.credential.counter) {
    throw new Error('WebAuthn signature counter did not advance (possible cloned passkey)');
  }

  return {
    newCounter: parsed.signCount > 0 ? parsed.signCount : params.credential.counter + 1,
  };
}
