#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

info() { printf '\033[1;32m[info]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[warn]\033[0m %s\n' "$*"; }
err() { printf '\033[1;31m[error]\033[0m %s\n' "$*" >&2; }

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    err "Missing required command: $1"
    exit 1
  fi
}

prompt_secret() {
  local prompt="$1"
  local value=""
  if [[ -t 0 ]]; then
    printf "%s" "$prompt" >&2
    stty -echo
    IFS= read -r value
    stty echo
    printf '\n' >&2
  else
    err "Interactive terminal is required for secret input."
    exit 1
  fi
  printf '%s' "$value"
}

require_cmd node
require_cmd npm

info "Installing npm dependencies..."
npm install

DEFAULT_WORKER_NAME="weread-mcp-worker"
CURRENT_NAME="$(grep -E '^name = ' wrangler.toml | head -1 | sed -E 's/name = "([^"]+)"/\1/' || true)"
if [[ -n "${CURRENT_NAME}" ]]; then
  DEFAULT_WORKER_NAME="$CURRENT_NAME"
fi

printf "Worker name [%s]: " "$DEFAULT_WORKER_NAME"
IFS= read -r WORKER_NAME
WORKER_NAME="${WORKER_NAME:-$DEFAULT_WORKER_NAME}"
SAFE_WORKER_NAME="$(printf '%s' "$WORKER_NAME" | sed -E 's/[^a-zA-Z0-9_-]+/-/g; s/^-+//; s/-+$//')"
if [[ -z "$SAFE_WORKER_NAME" ]]; then
  SAFE_WORKER_NAME="$DEFAULT_WORKER_NAME"
fi
if [[ "$SAFE_WORKER_NAME" != "$WORKER_NAME" ]]; then
  warn "Worker name contained unsupported characters; using: $SAFE_WORKER_NAME"
fi
WORKER_NAME="$SAFE_WORKER_NAME"

WORKER_NAME_TO_WRITE="$WORKER_NAME" node --input-type=module <<'NODE'
import { readFileSync, writeFileSync } from 'node:fs';
const workerName = process.env.WORKER_NAME_TO_WRITE || 'weread-mcp-worker';
const safeWorkerName = workerName.replace(/[^a-zA-Z0-9_-]/g, '-');
const path = 'wrangler.toml';
let text = readFileSync(path, 'utf8');
if (/^name = ".*"$/m.test(text)) {
  text = text.replace(/^name = ".*"$/m, `name = "${safeWorkerName}"`);
} else {
  text = `name = "${safeWorkerName}"\n` + text;
}
writeFileSync(path, text);
NODE

info "Checking Cloudflare Wrangler login..."
if ! npx wrangler whoami >/dev/null 2>&1; then
  warn "Wrangler is not logged in. Opening Cloudflare login..."
  npx wrangler login
fi

SETUP_PASSWORD="$(prompt_secret 'Setup password (leave empty to auto-generate): ')"
if [[ -z "$SETUP_PASSWORD" ]]; then
  SETUP_PASSWORD="$(node scripts/generate-secret.mjs)"
  warn "Generated setup password. Save it now; it will not be shown again:"
  printf '%s\n' "$SETUP_PASSWORD"
fi

ENCRYPTION_KEY="$(node scripts/generate-secret.mjs)"

info "Deploying Worker once so secrets can be attached..."
DEPLOY_LOG="$(mktemp)"
npx wrangler deploy 2>&1 | tee "$DEPLOY_LOG"

info "Uploading Cloudflare Worker secrets..."
printf '%s' "$ENCRYPTION_KEY" | npx wrangler secret put WEREAD_MCP_ENCRYPTION_KEY --name "$WORKER_NAME"
printf '%s' "$SETUP_PASSWORD" | npx wrangler secret put WEREAD_MCP_SETUP_PASSWORD --name "$WORKER_NAME"

info "Redeploying Worker with secret bindings..."
npx wrangler deploy 2>&1 | tee "$DEPLOY_LOG"

WORKER_URL="$(grep -Eo 'https://[^ ]+\.workers\.dev' "$DEPLOY_LOG" | tail -1 || true)"
if [[ -n "$WORKER_URL" ]]; then
  info "Deployment complete. Open setup page:"
  printf '\n  %s/setup\n\n' "$WORKER_URL"
else
  info "Deployment complete. Open your Worker URL and visit /setup."
fi

warn "Do not share the generated MCP URL. Do not commit .dev.vars, .env, API keys, or generated URLs to GitHub."
