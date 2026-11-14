export function base64urlToBuffer(b64url: string): ArrayBuffer {
  const pad = '='.repeat((4 - (b64url.length % 4)) % 4);
  const b64 = (b64url + pad).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes.buffer;
}

export function bufferToBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let bin = '';
  for (let i = 0; i < bytes.byteLength; i += 1) {
    bin += String.fromCharCode(bytes[i]!);
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function isWebAuthnSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.PublicKeyCredential !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    Boolean(navigator.credentials?.create) &&
    Boolean(navigator.credentials?.get)
  );
}

export interface ServerRegistrationOptions {
  challenge: string;
  rp: { id: string; name: string };
  user: { id: string; name: string; displayName: string };
  pubKeyCredParams: Array<{ type: 'public-key'; alg: number }>;
  timeout?: number;
  attestation?: AttestationConveyancePreference;
  excludeCredentials?: Array<{ id: string; type: 'public-key'; transports?: AuthenticatorTransport[] }>;
  authenticatorSelection?: AuthenticatorSelectionCriteria;
}

export interface ServerAuthenticationOptions {
  challenge: string;
  rpId?: string;
  timeout?: number;
  userVerification?: UserVerificationRequirement;
  allowCredentials?: Array<{ id: string; type: 'public-key'; transports?: AuthenticatorTransport[] }>;
}

export async function createBrowserPasskey(options: ServerRegistrationOptions) {
  if (!isWebAuthnSupported()) {
    throw new Error('WebAuthn / Passkeys are not supported by this browser.');
  }

  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge: base64urlToBuffer(options.challenge),
      rp: options.rp,
      user: {
        id: base64urlToBuffer(options.user.id),
        name: options.user.name,
        displayName: options.user.displayName,
      },
      pubKeyCredParams: options.pubKeyCredParams,
      timeout: options.timeout ?? 60000,
      attestation: options.attestation ?? 'none',
      excludeCredentials: options.excludeCredentials?.map((c) => ({
        id: base64urlToBuffer(c.id),
        type: 'public-key',
        transports: c.transports,
      })),
      authenticatorSelection: options.authenticatorSelection,
    },
  })) as PublicKeyCredential | null;

  if (!credential) {
    throw new Error('Passkey creation was cancelled.');
  }

  const response = credential.response as AuthenticatorAttestationResponse;
  return {
    id: credential.id,
    rawId: bufferToBase64url(credential.rawId),
    transports: typeof response.getTransports === 'function' ? response.getTransports() : [],
    response: {
      clientDataJSON: bufferToBase64url(response.clientDataJSON),
      attestationObject: bufferToBase64url(response.attestationObject),
    },
  };
}

export async function getBrowserPasskeyAssertion(options: ServerAuthenticationOptions) {
  if (!isWebAuthnSupported()) {
    throw new Error('WebAuthn / Passkeys are not supported by this browser.');
  }

  const credential = (await navigator.credentials.get({
    publicKey: {
      challenge: base64urlToBuffer(options.challenge),
      rpId: options.rpId,
      timeout: options.timeout ?? 60000,
      userVerification: options.userVerification ?? 'preferred',
      allowCredentials: options.allowCredentials?.map((c) => ({
        id: base64urlToBuffer(c.id),
        type: 'public-key',
        transports: c.transports,
      })),
    },
  })) as PublicKeyCredential | null;

  if (!credential) {
    throw new Error('Passkey prompt was cancelled.');
  }

  const response = credential.response as AuthenticatorAssertionResponse;
  return {
    id: credential.id,
    rawId: bufferToBase64url(credential.rawId),
    response: {
      clientDataJSON: bufferToBase64url(response.clientDataJSON),
      authenticatorData: bufferToBase64url(response.authenticatorData),
      signature: bufferToBase64url(response.signature),
      userHandle: response.userHandle ? bufferToBase64url(response.userHandle) : null,
    },
  };
}
