import { base64UrlToBytes, bytesToBase64Url } from "../utils/base64url";

const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder();
const TOKEN_PREFIX = "v1_";
const TOKEN_VERSION = 1;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const PBKDF2_ITERATIONS = 100_000;

export class TokenCryptoError extends Error {
  constructor(message = "Invalid encrypted token") {
    super(message);
    this.name = "TokenCryptoError";
  }
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return copy.buffer;
}

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

async function deriveAesGcmKey(secret: string, salt: Uint8Array): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    TEXT_ENCODER.encode(secret),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: toArrayBuffer(salt),
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256"
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptJsonToToken(payload: unknown, secret: string): Promise<string> {
  if (!secret || !secret.trim()) {
    throw new TokenCryptoError("Missing encryption secret");
  }

  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const key = await deriveAesGcmKey(secret, salt);
  const plaintext = TEXT_ENCODER.encode(JSON.stringify(payload));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext));
  const packed = concatBytes(new Uint8Array([TOKEN_VERSION]), salt, iv, ciphertext);
  return `${TOKEN_PREFIX}${bytesToBase64Url(packed)}`;
}

export async function decryptJsonFromToken<T = unknown>(token: string, secret: string): Promise<T> {
  try {
    if (!secret || !secret.trim() || !token.startsWith(TOKEN_PREFIX)) {
      throw new TokenCryptoError();
    }

    const packed = base64UrlToBytes(token.slice(TOKEN_PREFIX.length));
    const minimumLength = 1 + SALT_LENGTH + IV_LENGTH + 16;
    if (packed.length < minimumLength || packed[0] !== TOKEN_VERSION) {
      throw new TokenCryptoError();
    }

    const salt = packed.slice(1, 1 + SALT_LENGTH);
    const iv = packed.slice(1 + SALT_LENGTH, 1 + SALT_LENGTH + IV_LENGTH);
    const ciphertext = packed.slice(1 + SALT_LENGTH + IV_LENGTH);
    const key = await deriveAesGcmKey(secret, salt);
    const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
    return JSON.parse(TEXT_DECODER.decode(plaintext)) as T;
  } catch (error) {
    if (error instanceof TokenCryptoError) throw error;
    throw new TokenCryptoError();
  }
}

export async function sha256Hex(value: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", TEXT_ENCODER.encode(value));
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function constantTimeEqual(a: string, b: string): boolean {
  const aBytes = TEXT_ENCODER.encode(a);
  const bBytes = TEXT_ENCODER.encode(b);
  const maxLength = Math.max(aBytes.length, bBytes.length);
  let diff = aBytes.length ^ bBytes.length;
  for (let i = 0; i < maxLength; i += 1) {
    diff |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  }
  return diff === 0;
}
