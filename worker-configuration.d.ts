// Generated-style Worker env typings kept in source for clarity.
interface Env {
  /** Required Cloudflare secret used to encrypt/decrypt URL path tokens. */
  WEREAD_MCP_ENCRYPTION_KEY: string;
  /** Required Cloudflare secret for the setup page. */
  WEREAD_MCP_SETUP_PASSWORD?: string;
  /** Optional SHA-256 hex digest of the setup password; preferred over plaintext if set. */
  WEREAD_MCP_SETUP_PASSWORD_SHA256?: string;
  /** Optional comma-separated list of allowed browser Origin values. */
  WEREAD_MCP_ALLOWED_ORIGINS?: string;
  /** Optional WeRead skill version. Defaults to 1.0.3. */
  WEREAD_SKILL_VERSION?: string;
  /** Optional override for the WeRead Agent API Gateway endpoint. */
  WEREAD_GATEWAY_URL?: string;
}
