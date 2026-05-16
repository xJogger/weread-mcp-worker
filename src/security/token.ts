import { decryptJsonFromToken, encryptJsonToToken, TokenCryptoError } from "./crypto";

export interface WeReadCredentialPayload {
  v: 1;
  type: "weread-api-key";
  wereadApiKey: string;
  createdAt: string;
}

export function normalizeWeReadApiKey(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

export async function createCredentialToken(wereadApiKey: string, encryptionSecret: string): Promise<string> {
  const normalized = normalizeWeReadApiKey(wereadApiKey);
  if (!normalized) {
    throw new Error("WeRead API key is required");
  }

  const payload: WeReadCredentialPayload = {
    v: 1,
    type: "weread-api-key",
    wereadApiKey: normalized,
    createdAt: new Date().toISOString()
  };
  return encryptJsonToToken(payload, encryptionSecret);
}

export async function readCredentialToken(token: string, encryptionSecret: string): Promise<WeReadCredentialPayload> {
  const payload = await decryptJsonFromToken<Partial<WeReadCredentialPayload>>(token, encryptionSecret);
  if (
    payload?.v !== 1 ||
    payload.type !== "weread-api-key" ||
    typeof payload.wereadApiKey !== "string" ||
    !payload.wereadApiKey.trim()
  ) {
    throw new TokenCryptoError();
  }

  return {
    v: 1,
    type: "weread-api-key",
    wereadApiKey: payload.wereadApiKey.trim(),
    createdAt: typeof payload.createdAt === "string" ? payload.createdAt : ""
  };
}
