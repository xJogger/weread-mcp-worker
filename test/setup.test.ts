import { describe, expect, it } from "vitest";
import worker from "../src/index";

const env: Env = {
  WEREAD_MCP_ENCRYPTION_KEY: "setup-test-encryption-key",
  WEREAD_MCP_SETUP_PASSWORD: "setup-password",
  WEREAD_SKILL_VERSION: "1.0.3"
};

describe("setup endpoint", () => {
  it("generates an encrypted MCP URL", async () => {
    const response = await worker.fetch(new Request("https://example.com/api/generate-url", {
      method: "POST",
      headers: { "content-type": "application/json", "origin": "https://example.com" },
      body: JSON.stringify({ setupPassword: "setup-password", wereadApiKey: "example-api-key" })
    }), env);

    expect(response.status).toBe(200);
    const json = await response.json() as any;
    expect(json.mcpUrl).toMatch(/^https:\/\/example\.com\/mcp\/v1_[A-Za-z0-9_-]+$/);
    expect(json.mcpUrl).not.toContain("example-api-key");
  });

  it("rejects wrong setup passwords", async () => {
    const response = await worker.fetch(new Request("https://example.com/api/generate-url", {
      method: "POST",
      headers: { "content-type": "application/json", "origin": "https://example.com" },
      body: JSON.stringify({ setupPassword: "wrong", wereadApiKey: "example-api-key" })
    }), env);

    expect(response.status).toBe(401);
  });
});
