import { describe, expect, it, vi } from "vitest";
import { createCredentialToken } from "../src/security/token";
import { handleMcpPost } from "../src/mcp/server";

const env: Env = {
  WEREAD_MCP_ENCRYPTION_KEY: "mcp-test-encryption-key",
  WEREAD_MCP_SETUP_PASSWORD: "setup",
  WEREAD_SKILL_VERSION: "1.0.3"
};

async function post(token: string, body: unknown): Promise<Response> {
  return handleMcpPost(new Request(`https://example.com/mcp/${token}`, {
    method: "POST",
    headers: { "content-type": "application/json", "accept": "application/json, text/event-stream" },
    body: JSON.stringify(body)
  }), env, token);
}

describe("MCP server", () => {
  it("initializes", async () => {
    const token = await createCredentialToken("wrk-test", env.WEREAD_MCP_ENCRYPTION_KEY);
    const response = await post(token, { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-11-25" } });
    expect(response.status).toBe(200);
    const json = await response.json() as any;
    expect(json.result.serverInfo.name).toBe("weread-mcp-worker");
    expect(json.result.capabilities.tools).toBeTruthy();
  });

  it("lists tools", async () => {
    const token = await createCredentialToken("wrk-test", env.WEREAD_MCP_ENCRYPTION_KEY);
    const response = await post(token, { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
    expect(response.status).toBe(200);
    const json = await response.json() as any;
    expect(json.result.tools.some((tool: any) => tool.name === "weread_get_bookshelf")).toBe(true);
    expect(json.result.tools.some((tool: any) => tool.name === "weread_get_profile")).toBe(true);
    expect(json.result.tools.some((tool: any) => tool.name === "search")).toBe(true);
  });

  it("calls the profile composite tool", async () => {
    const token = await createCredentialToken("wrk-test", env.WEREAD_MCP_ENCRYPTION_KEY);
    vi.stubGlobal("fetch", async (_url: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body || "{}"));
      if (body.api_name === "/shelf/sync") {
        return new Response(JSON.stringify({
          books: [{ bookId: "book-1", title: "测试书", author: "作者", readUpdateTime: 1760000000, secret: 0 }],
          albums: [],
          archive: [],
          bookCount: 1
        }), { status: 200, headers: { "content-type": "application/json" } });
      }
      if (body.api_name === "/book/getprogress") {
        return new Response(JSON.stringify({
          bookId: body.bookId,
          book: { progress: 42, recordReadingTime: 3600, updateTime: 1760000000 },
          timestamp: 1760000000
        }), { status: 200, headers: { "content-type": "application/json" } });
      }
      return new Response(JSON.stringify({ errcode: 404, errmsg: "unexpected api" }), { status: 200 });
    });

    try {
      const response = await post(token, {
        jsonrpc: "2.0",
        id: 4,
        method: "tools/call",
        params: {
          name: "weread_get_profile",
          arguments: {
            progressLimit: 1,
            includeReadingStats: false,
            includeNotebookOverview: false,
            highlightCountLimit: 0
          }
        }
      });
      expect(response.status).toBe(200);
      const json = await response.json() as any;
      const profile = json.result.structuredContent;
      expect(profile.shelf.summary.totalShelfItems).toBe(1);
      expect(profile.recentReading[0].bookId).toBe("book-1");
      expect(profile.recentReading[0].progress.book.progressLabel).toBe("42%");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("rejects invalid tokens", async () => {
    const response = await post("v1_invalid", { jsonrpc: "2.0", id: 3, method: "tools/list", params: {} });
    expect(response.status).toBe(401);
    const json = await response.json() as any;
    expect(json.error.message).toContain("Invalid MCP URL token");
  });
});
