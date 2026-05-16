import { readCredentialToken } from "../security/token";
import { requireEnv } from "../utils/env";
import { jsonResponse, readJson } from "../utils/json";
import { noStoreJsonHeaders } from "../utils/http";
import { callWeReadTool, WEREAD_TOOLS } from "./tools";
import type { JsonRpcId, JsonRpcRequest } from "./schema";
import { JSON_RPC_ERROR, jsonRpcError, jsonRpcResult } from "./responses";

const SERVER_NAME = "weread-mcp-worker";
const SERVER_VERSION = "0.1.0";
const SUPPORTED_PROTOCOL_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];

function isJsonRpcRequest(value: unknown): value is JsonRpcRequest {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function requestId(request: JsonRpcRequest): JsonRpcId | undefined {
  const id = request.id;
  if (typeof id === "string" || typeof id === "number" || id === null) return id;
  return undefined;
}

function getParamsObject(params: unknown): Record<string, unknown> {
  if (!params) return {};
  if (typeof params !== "object" || Array.isArray(params)) return {};
  return params as Record<string, unknown>;
}

function negotiateProtocolVersion(params: unknown): string {
  const requested = getParamsObject(params).protocolVersion;
  if (typeof requested === "string" && SUPPORTED_PROTOCOL_VERSIONS.includes(requested)) return requested;
  return SUPPORTED_PROTOCOL_VERSIONS[0] ?? "2025-11-25";
}

function isNotification(request: JsonRpcRequest): boolean {
  return request.id === undefined;
}

function mcpJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: noStoreJsonHeaders({
      "mcp-protocol-version": SUPPORTED_PROTOCOL_VERSIONS[0] ?? "2025-11-25"
    })
  });
}

export async function handleMcpGet(): Promise<Response> {
  return new Response("This MCP server supports Streamable HTTP POST requests. SSE GET is not implemented.", {
    status: 405,
    headers: {
      "allow": "POST, OPTIONS",
      "cache-control": "no-store",
      "content-type": "text/plain; charset=utf-8"
    }
  });
}

export async function handleMcpPost(request: Request, env: Env, encryptedToken: string): Promise<Response> {
  let apiKey: string;
  try {
    const encryptionKey = requireEnv(env.WEREAD_MCP_ENCRYPTION_KEY, "WEREAD_MCP_ENCRYPTION_KEY");
    const payload = await readCredentialToken(encryptedToken, encryptionKey);
    apiKey = payload.wereadApiKey;
  } catch {
    return mcpJsonResponse(jsonRpcError(null, JSON_RPC_ERROR.UNAUTHORIZED, "Invalid MCP URL token."), 401);
  }

  let message: unknown;
  try {
    message = await readJson<unknown>(request);
  } catch {
    return mcpJsonResponse(jsonRpcError(null, JSON_RPC_ERROR.PARSE_ERROR, "Invalid or missing JSON body."), 400);
  }

  if (Array.isArray(message)) {
    return mcpJsonResponse(jsonRpcError(null, JSON_RPC_ERROR.INVALID_REQUEST, "Batch JSON-RPC requests are not supported."), 400);
  }

  if (!isJsonRpcRequest(message) || message.jsonrpc !== "2.0" || typeof message.method !== "string") {
    return mcpJsonResponse(jsonRpcError(null, JSON_RPC_ERROR.INVALID_REQUEST, "Invalid JSON-RPC request."), 400);
  }

  const id = requestId(message);

  // Notifications do not receive JSON-RPC responses. Accept initialized and tolerate unknown notifications.
  if (isNotification(message)) {
    return new Response(null, {
      status: 202,
      headers: {
        "cache-control": "no-store",
        "mcp-protocol-version": SUPPORTED_PROTOCOL_VERSIONS[0] ?? "2025-11-25"
      }
    });
  }

  try {
    switch (message.method) {
      case "initialize": {
        const protocolVersion = negotiateProtocolVersion(message.params);
        return mcpJsonResponse(jsonRpcResult(id, {
          protocolVersion,
          capabilities: {
            tools: { listChanged: false }
          },
          serverInfo: {
            name: SERVER_NAME,
            version: SERVER_VERSION
          },
          instructions: "Use these read-only tools to search WeRead, inspect the authenticated user's bookshelf, reading progress, notes, highlights, reviews, recommendations, and reading statistics. Generated MCP URLs are sensitive bearer credentials."
        }));
      }

      case "ping": {
        return mcpJsonResponse(jsonRpcResult(id, {}));
      }

      case "tools/list": {
        return mcpJsonResponse(jsonRpcResult(id, { tools: WEREAD_TOOLS }));
      }

      case "tools/call": {
        const params = getParamsObject(message.params);
        const name = typeof params.name === "string" ? params.name : "";
        if (!name) {
          return mcpJsonResponse(jsonRpcError(id, JSON_RPC_ERROR.INVALID_PARAMS, "tools/call requires params.name."), 400);
        }
        const result = await callWeReadTool(name, params.arguments, { apiKey, env });
        return mcpJsonResponse(jsonRpcResult(id, result));
      }

      case "resources/list": {
        return mcpJsonResponse(jsonRpcResult(id, { resources: [] }));
      }

      case "prompts/list": {
        return mcpJsonResponse(jsonRpcResult(id, { prompts: [] }));
      }

      default:
        return mcpJsonResponse(jsonRpcError(id, JSON_RPC_ERROR.METHOD_NOT_FOUND, `Method not found: ${message.method}`), 404);
    }
  } catch (error) {
    const messageText = error instanceof Error ? error.message : "Internal server error.";
    return mcpJsonResponse(jsonRpcError(id, JSON_RPC_ERROR.INTERNAL_ERROR, messageText), 500);
  }
}
