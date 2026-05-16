import { safeJsonStringify } from "../utils/json";
import type { JsonRpcId, McpToolResult } from "./schema";

export const JSON_RPC = "2.0" as const;

export const JSON_RPC_ERROR = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  UNAUTHORIZED: -32001
} as const;

export function jsonRpcResult(id: JsonRpcId | undefined, result: unknown): Record<string, unknown> {
  return { jsonrpc: JSON_RPC, id: id ?? null, result };
}

export function jsonRpcError(id: JsonRpcId | undefined, code: number, message: string, data?: unknown): Record<string, unknown> {
  const error: Record<string, unknown> = { code, message };
  if (data !== undefined) error.data = data;
  return { jsonrpc: JSON_RPC, id: id ?? null, error };
}

export function toolResult(structuredContent: Record<string, unknown>): McpToolResult {
  return {
    structuredContent,
    content: [{ type: "text", text: safeJsonStringify(structuredContent) }],
    isError: false
  };
}

export function toolTextResult(text: string, structuredContent?: Record<string, unknown>): McpToolResult {
  return {
    ...(structuredContent ? { structuredContent } : {}),
    content: [{ type: "text", text }],
    isError: false
  };
}

export function toolExecutionError(message: string, data?: Record<string, unknown>): McpToolResult {
  const structuredContent = { error: message, ...(data || {}) };
  return {
    structuredContent,
    content: [{ type: "text", text: safeJsonStringify(structuredContent) }],
    isError: true
  };
}
