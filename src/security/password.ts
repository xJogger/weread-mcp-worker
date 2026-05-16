import { constantTimeEqual, sha256Hex } from "./crypto";

const HEX_64 = /^[a-fA-F0-9]{64}$/;

export async function verifySetupPassword(input: unknown, env: Pick<Env, "WEREAD_MCP_SETUP_PASSWORD" | "WEREAD_MCP_SETUP_PASSWORD_SHA256">): Promise<boolean> {
  if (typeof input !== "string" || !input) return false;

  const configuredHash = env.WEREAD_MCP_SETUP_PASSWORD_SHA256?.trim();
  if (configuredHash) {
    if (!HEX_64.test(configuredHash)) return false;
    const inputHash = await sha256Hex(input);
    return constantTimeEqual(inputHash.toLowerCase(), configuredHash.toLowerCase());
  }

  const configuredPlaintext = env.WEREAD_MCP_SETUP_PASSWORD;
  if (!configuredPlaintext) return false;

  // Compare SHA-256 digests to avoid leaking early string-comparison timing.
  const [inputHash, configuredPlaintextHash] = await Promise.all([
    sha256Hex(input),
    sha256Hex(configuredPlaintext)
  ]);
  return constantTimeEqual(inputHash, configuredPlaintextHash);
}

export function isSetupConfigured(env: Pick<Env, "WEREAD_MCP_SETUP_PASSWORD" | "WEREAD_MCP_SETUP_PASSWORD_SHA256">): boolean {
  return Boolean(env.WEREAD_MCP_SETUP_PASSWORD_SHA256?.trim() || env.WEREAD_MCP_SETUP_PASSWORD?.trim());
}
