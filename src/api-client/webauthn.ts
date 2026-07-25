import type { PasskeyCredentialJSON } from "./auth-contracts";

function decodeBase64url(value: string): ArrayBuffer {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const bytes = Uint8Array.from(atob(padded), (character) =>
    character.charCodeAt(0)
  );
  return bytes.buffer;
}

function encodeBase64url(value: ArrayBuffer | null): string | null {
  if (value === null) return null;
  const bytes = new Uint8Array(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/u, "");
}

function credentialDescriptors(
  value: unknown
): PublicKeyCredentialDescriptor[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.map((descriptor) => {
    const item = descriptor as {
      id: string;
      type: PublicKeyCredentialType;
      transports?: AuthenticatorTransport[];
    };
    return { ...item, id: decodeBase64url(item.id) };
  });
}

function registrationOptions(
  json: Record<string, unknown>
): PublicKeyCredentialCreationOptions {
  const user = json.user as Record<string, unknown>;
  return {
    ...(json as unknown as PublicKeyCredentialCreationOptions),
    challenge: decodeBase64url(json.challenge as string),
    user: {
      ...(user as unknown as PublicKeyCredentialUserEntity),
      id: decodeBase64url(user.id as string),
    },
    excludeCredentials: credentialDescriptors(json.excludeCredentials),
  };
}

function authenticationOptions(
  json: Record<string, unknown>
): PublicKeyCredentialRequestOptions {
  return {
    ...(json as unknown as PublicKeyCredentialRequestOptions),
    challenge: decodeBase64url(json.challenge as string),
    allowCredentials: credentialDescriptors(json.allowCredentials),
  };
}

function baseCredential(credential: PublicKeyCredential) {
  return {
    id: credential.id,
    rawId: encodeBase64url(credential.rawId)!,
    type: "public-key" as const,
    authenticatorAttachment: credential.authenticatorAttachment,
    clientExtensionResults: credential.getClientExtensionResults(),
  };
}

export async function createPasskey(
  options: Record<string, unknown>
): Promise<PasskeyCredentialJSON> {
  const credential = (await navigator.credentials.create({
    publicKey: registrationOptions(options),
  })) as PublicKeyCredential | null;
  if (!credential) throw new Error("The browser did not create a passkey.");

  const response = credential.response as AuthenticatorAttestationResponse;
  return {
    ...baseCredential(credential),
    response: {
      clientDataJSON: encodeBase64url(response.clientDataJSON),
      attestationObject: encodeBase64url(response.attestationObject),
      transports: response.getTransports?.() ?? [],
      publicKeyAlgorithm: response.getPublicKeyAlgorithm?.(),
      publicKey: encodeBase64url(response.getPublicKey?.() ?? null),
      authenticatorData: encodeBase64url(
        response.getAuthenticatorData?.() ?? null
      ),
    },
  };
}

export async function getPasskey(
  options: Record<string, unknown>
): Promise<PasskeyCredentialJSON> {
  const credential = (await navigator.credentials.get({
    publicKey: authenticationOptions(options),
  })) as PublicKeyCredential | null;
  if (!credential) throw new Error("The browser did not return a passkey.");

  const response = credential.response as AuthenticatorAssertionResponse;
  return {
    ...baseCredential(credential),
    response: {
      clientDataJSON: encodeBase64url(response.clientDataJSON),
      authenticatorData: encodeBase64url(response.authenticatorData),
      signature: encodeBase64url(response.signature),
      userHandle: encodeBase64url(response.userHandle),
    },
  };
}

export function passkeyError(error: unknown): string {
  if (!(error instanceof DOMException)) {
    return error instanceof Error ? error.message : "Passkey operation failed.";
  }
  switch (error.name) {
    case "NotAllowedError":
    case "AbortError":
      return "The passkey prompt was cancelled or timed out.";
    case "InvalidStateError":
      return "That passkey is already registered.";
    case "SecurityError":
      return "This page is not using the origin expected by the passkey.";
    default:
      return "The browser could not complete the passkey operation.";
  }
}

