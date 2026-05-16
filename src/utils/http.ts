const DEFAULT_ALLOWED_ORIGINS = new Set([
  "https://chatgpt.com",
  "https://chat.openai.com",
  "https://platform.openai.com"
]);

export function securityHeaders(extra?: HeadersInit): Headers {
  const headers = new Headers(extra);
  headers.set("x-content-type-options", "nosniff");
  headers.set("referrer-policy", "no-referrer");
  headers.set("permissions-policy", "camera=(), microphone=(), geolocation=(), interest-cohort=()");
  headers.set("content-security-policy", "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
  return headers;
}

export function htmlResponse(html: string, init: ResponseInit = {}): Response {
  const headers = securityHeaders(init.headers);
  headers.set("content-type", "text/html; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(html, { ...init, headers });
}

export function textResponse(text: string, init: ResponseInit = {}): Response {
  const headers = securityHeaders(init.headers);
  headers.set("content-type", "text/plain; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(text, { ...init, headers });
}

export function parseAllowedOrigins(envValue?: string): Set<string> {
  const origins = new Set(DEFAULT_ALLOWED_ORIGINS);
  for (const item of (envValue || "").split(",")) {
    const origin = item.trim();
    if (origin) origins.add(origin);
  }
  return origins;
}

export function isAllowedOrigin(request: Request, envValue?: string): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  const url = new URL(request.url);
  const sameOrigin = `${url.protocol}//${url.host}`;
  if (origin === sameOrigin) return true;

  return parseAllowedOrigins(envValue).has(origin);
}

export function corsHeadersForRequest(request: Request, envValue?: string): Headers {
  const headers = new Headers();
  const origin = request.headers.get("origin");
  if (origin && isAllowedOrigin(request, envValue)) {
    headers.set("access-control-allow-origin", origin);
    headers.set("vary", "origin");
  }
  headers.set("access-control-allow-methods", "GET, POST, OPTIONS");
  headers.set("access-control-allow-headers", "content-type, accept, mcp-protocol-version, mcp-session-id, last-event-id");
  headers.set("access-control-max-age", "86400");
  return headers;
}

export function forbiddenOriginResponse(request: Request, envValue?: string): Response | null {
  if (isAllowedOrigin(request, envValue)) return null;
  return new Response("Forbidden origin", {
    status: 403,
    headers: securityHeaders(corsHeadersForRequest(request, envValue))
  });
}

export function noStoreJsonHeaders(extra?: HeadersInit): Headers {
  const headers = securityHeaders(extra);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  return headers;
}
