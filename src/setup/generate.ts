import { createCredentialToken, normalizeWeReadApiKey } from "../security/token";
import { isSetupConfigured, verifySetupPassword } from "../security/password";
import { jsonResponse, readJson } from "../utils/json";
import { requireEnv } from "../utils/env";

interface GenerateUrlRequest {
  setupPassword?: unknown;
  wereadApiKey?: unknown;
}

export async function handleGenerateUrl(request: Request, env: Env): Promise<Response> {
  if (!isSetupConfigured(env)) {
    return jsonResponse({ error: "Setup password is not configured. Set WEREAD_MCP_SETUP_PASSWORD or WEREAD_MCP_SETUP_PASSWORD_SHA256." }, { status: 500 });
  }

  let input: GenerateUrlRequest;
  try {
    input = await readJson<GenerateUrlRequest>(request);
  } catch {
    return jsonResponse({ error: "Expected JSON body." }, { status: 400 });
  }

  const ok = await verifySetupPassword(input.setupPassword, env);
  if (!ok) {
    return jsonResponse({ error: "Invalid setup password." }, { status: 401 });
  }

  const wereadApiKey = normalizeWeReadApiKey(input.wereadApiKey);
  if (!wereadApiKey) {
    return jsonResponse({ error: "WeRead API key is required." }, { status: 400 });
  }

  const encryptionKey = requireEnv(env.WEREAD_MCP_ENCRYPTION_KEY, "WEREAD_MCP_ENCRYPTION_KEY");
  const token = await createCredentialToken(wereadApiKey, encryptionKey);
  const url = new URL(request.url);
  const mcpUrl = `${url.protocol}//${url.host}/mcp/${token}`;

  return jsonResponse({
    mcpUrl,
    warning: "This URL is sensitive. Anyone with this URL can call your WeRead MCP tools."
  });
}
