import { describe, expect, it } from "vitest";
import { createCredentialToken, readCredentialToken } from "../src/security/token";
import { TokenCryptoError } from "../src/security/crypto";

const SECRET = "test-secret-1234567890";

describe("credential token crypto", () => {
  it("round trips a WeRead API key without exposing plaintext in the token", async () => {
    const token = await createCredentialToken("wrk-example-secret", SECRET);
    expect(token).toMatch(/^v1_[A-Za-z0-9_-]+$/);
    expect(token).not.toContain("wrk-example-secret");

    const payload = await readCredentialToken(token, SECRET);
    expect(payload.wereadApiKey).toBe("wrk-example-secret");
    expect(payload.type).toBe("weread-api-key");
  });

  it("rejects tampered tokens", async () => {
    const token = await createCredentialToken("wrk-example-secret", SECRET);
    const index = Math.min(12, token.length - 1);
    const replacement = token[index] === "A" ? "B" : "A";
    const tampered = token.slice(0, index) + replacement + token.slice(index + 1);
    await expect(readCredentialToken(tampered, SECRET)).rejects.toBeInstanceOf(TokenCryptoError);
  });

  it("rejects wrong encryption secrets", async () => {
    const token = await createCredentialToken("wrk-example-secret", SECRET);
    await expect(readCredentialToken(token, "wrong-secret")).rejects.toBeInstanceOf(TokenCryptoError);
  });
});
