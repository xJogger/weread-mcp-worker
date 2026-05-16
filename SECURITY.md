# Security Policy

## Sensitive data handled by this project

This project can handle the following sensitive data:

- WeRead Agent API Key.
- Generated MCP URL path token.
- Cloudflare Worker secrets.
- Personal reading data, including bookshelf, notes, highlights, reviews, and reading statistics.

## Core security rule

The generated MCP URL is a bearer credential. Anyone who has the URL can call the MCP tools exposed by your Worker.

Do not share it.
Do not commit it.
Do not paste it into public issues.
Do not include it in screenshots.

## Secrets that must never be committed

- `.env`
- `.dev.vars`
- Real WeRead API Key.
- Real generated MCP URL.
- `WEREAD_MCP_ENCRYPTION_KEY` value.
- `WEREAD_MCP_SETUP_PASSWORD` value.
- Cloudflare API tokens.
- Cookies or session data.

## Recommended deployment practices

- Use `wrangler secret put` for sensitive values.
- Keep `wrangler.toml` limited to non-sensitive configuration.
- Rotate `WEREAD_MCP_ENCRYPTION_KEY` if a generated MCP URL may have leaked.
- Disable unnecessary Cloudflare request logging if logs would capture URL paths.
- Review Worker code before connecting it to ChatGPT.
- Keep the Worker single-user unless you add a real multi-user authorization layer.

## Reporting a vulnerability

If you publish this project publicly, replace this section with your preferred security contact.

Please do not include real API keys, tokens, generated MCP URLs, or personal reading data in public reports.
