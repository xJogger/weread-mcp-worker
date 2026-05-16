import { describe, expect, it } from "vitest";
import { WeReadClient } from "../src/weread/client";
import { WeReadApiError } from "../src/weread/errors";

describe("WeReadClient", () => {
  it("calls the agent gateway with flattened params and skill_version", async () => {
    let captured: any;
    const fetcher: typeof fetch = async (_url, init) => {
      captured = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ ok: true, books: [] }), { status: 200, headers: { "content-type": "application/json" } });
    };
    const client = new WeReadClient({ apiKey: "wrk-test", skillVersion: "1.0.3", fetcher });
    const result = await client.call("/user/notebooks", { count: 20, lastSort: 123 });
    expect(result.ok).toBe(true);
    expect(captured).toEqual({ api_name: "/user/notebooks", count: 20, lastSort: 123, skill_version: "1.0.3" });
    expect(captured.params).toBeUndefined();
  });

  it("turns errcode into WeReadApiError", async () => {
    const fetcher: typeof fetch = async () => new Response(JSON.stringify({ errcode: 401, errmsg: "bad key" }), { status: 200 });
    const client = new WeReadClient({ apiKey: "wrk-test", fetcher });
    await expect(client.call("/shelf/sync")).rejects.toBeInstanceOf(WeReadApiError);
  });

  it("binds fetch to globalThis to avoid illegal invocation errors", async () => {
    const originalFetch = globalThis.fetch;
    let sawCorrectThis = false;
    const boundRequiredFetch = async function (this: typeof globalThis, _url: RequestInfo | URL, init?: RequestInit): Promise<Response> {
      sawCorrectThis = this === globalThis;
      if (!sawCorrectThis) throw new TypeError("Illegal invocation: function called with incorrect this reference");
      const body = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ ok: true, api_name: body.api_name }), { status: 200 });
    } as typeof fetch;

    try {
      globalThis.fetch = boundRequiredFetch;
      const client = new WeReadClient({ apiKey: "example-api-key" });
      const result = await client.call("/shelf/sync");
      expect(result.ok).toBe(true);
      expect(sawCorrectThis).toBe(true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
