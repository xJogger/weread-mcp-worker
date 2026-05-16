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
});
