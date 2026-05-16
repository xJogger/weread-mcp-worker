import { handleMcpGet, handleMcpPost } from "./mcp/server";
import { handleGenerateUrl } from "./setup/generate";
import { setupPageHtml } from "./setup/page";
import { corsHeadersForRequest, forbiddenOriginResponse, htmlResponse, textResponse } from "./utils/http";
import { jsonResponse } from "./utils/json";

function withCors(response: Response, request: Request, env: Env): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of corsHeadersForRequest(request, env.WEREAD_MCP_ALLOWED_ORIGINS)) {
    headers.set(key, value);
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function extractMcpToken(pathname: string): string | null {
  const match = pathname.match(/^\/mcp\/([^/?#]+)\/?$/);
  return match ? decodeURIComponent(match[1] ?? "") : null;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const originDenied = forbiddenOriginResponse(request, env.WEREAD_MCP_ALLOWED_ORIGINS);
    if (originDenied) return originDenied;

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeadersForRequest(request, env.WEREAD_MCP_ALLOWED_ORIGINS) });
    }

    const url = new URL(request.url);
    const token = extractMcpToken(url.pathname);

    try {
      if (url.pathname === "/" && request.method === "GET") {
        return htmlResponse(setupPageHtml());
      }

      if (url.pathname === "/setup" && request.method === "GET") {
        return htmlResponse(setupPageHtml());
      }

      if (url.pathname === "/api/generate-url" && request.method === "POST") {
        return withCors(await handleGenerateUrl(request, env), request, env);
      }

      if (url.pathname === "/health" && request.method === "GET") {
        return jsonResponse({ ok: true, service: "weread-mcp-worker" });
      }

      if (token && request.method === "GET") {
        return withCors(await handleMcpGet(), request, env);
      }

      if (token && request.method === "POST") {
        return withCors(await handleMcpPost(request, env, token), request, env);
      }

      return textResponse("Not found", { status: 404 });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Internal server error";
      return jsonResponse({ error: message }, { status: 500 });
    }
  }
};
