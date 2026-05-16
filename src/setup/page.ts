export function setupPageHtml(): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>WeRead MCP Worker Setup</title>
  <style>
    :root { color-scheme: light dark; --bg: #0f172a; --card: #111827; --text: #e5e7eb; --muted: #9ca3af; --accent: #22c55e; --danger: #f97316; --border: #374151; }
    @media (prefers-color-scheme: light) { :root { --bg: #f8fafc; --card: #ffffff; --text: #0f172a; --muted: #475569; --border: #cbd5e1; } }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: radial-gradient(circle at top, rgba(34,197,94,.12), transparent 34rem), var(--bg); color: var(--text); }
    main { max-width: 860px; margin: 0 auto; padding: 48px 20px; }
    .card { background: color-mix(in srgb, var(--card) 92%, transparent); border: 1px solid var(--border); border-radius: 18px; padding: 28px; box-shadow: 0 24px 80px rgba(0,0,0,.22); }
    h1 { margin: 0 0 8px; font-size: clamp(28px, 4vw, 44px); letter-spacing: -0.03em; }
    p { color: var(--muted); line-height: 1.7; }
    label { display: block; margin: 18px 0 8px; font-weight: 700; }
    input, textarea { width: 100%; border: 1px solid var(--border); border-radius: 12px; padding: 13px 14px; background: transparent; color: var(--text); font: inherit; }
    textarea { min-height: 120px; resize: vertical; }
    button { border: 0; border-radius: 12px; padding: 12px 18px; font: inherit; font-weight: 800; color: #06220f; background: var(--accent); cursor: pointer; }
    button.secondary { color: var(--text); background: transparent; border: 1px solid var(--border); }
    button:disabled { opacity: .55; cursor: not-allowed; }
    .actions { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 20px; }
    .warning { border-left: 4px solid var(--danger); padding: 12px 14px; background: rgba(249,115,22,.10); border-radius: 10px; color: var(--text); }
    .result { margin-top: 22px; display: none; }
    .urlbox { word-break: break-all; white-space: pre-wrap; padding: 14px; border: 1px solid var(--border); border-radius: 12px; background: rgba(127,127,127,.08); color: var(--text); }
    .error { color: #fca5a5; white-space: pre-wrap; }
    code { color: var(--text); background: rgba(127,127,127,.13); padding: 2px 5px; border-radius: 6px; }
    .small { font-size: 13px; }
  </style>
</head>
<body>
  <main>
    <section class="card">
      <h1>WeRead MCP Worker Setup</h1>
      <p>输入部署时设置的 Setup 密码和微信读书 API Key，生成可添加到 ChatGPT 的加密 MCP URL。</p>
      <div class="warning">
        <strong>安全提醒：</strong>生成的 MCP URL 是敏感凭据。任何拿到该 URL 的人都可以通过此 Worker 调用你的微信读书 MCP 工具。不要公开、截图或提交到 GitHub。
      </div>
      <form id="setup-form" autocomplete="off">
        <label for="setupPassword">Setup 密码</label>
        <input id="setupPassword" name="setupPassword" type="password" required autocomplete="current-password" placeholder="部署时设置的 WEREAD_MCP_SETUP_PASSWORD" />

        <label for="wereadApiKey">微信读书 API Key</label>
        <textarea id="wereadApiKey" name="wereadApiKey" required spellcheck="false" autocomplete="off" placeholder="wrk-xxxxxxxx"></textarea>
        <p class="small">API Key 只会被发送到当前 Worker，用 Worker Secret 中的加密密钥加密后放入 URL 路径；项目不会把它写入 Git 仓库。</p>

        <div class="actions">
          <button id="generate" type="submit">生成 MCP URL</button>
          <button class="secondary" id="clear" type="button">清空</button>
        </div>
      </form>

      <div id="result" class="result">
        <h2>你的 MCP URL</h2>
        <pre id="mcpUrl" class="urlbox"></pre>
        <div class="actions">
          <button id="copy" type="button">复制 URL</button>
        </div>
        <p class="small">在 ChatGPT 的 Apps / Developer Mode 中创建或添加远程 MCP Server 时使用这个 URL。</p>
      </div>
      <p id="error" class="error"></p>
    </section>
  </main>
  <script>
    const form = document.getElementById('setup-form');
    const generateButton = document.getElementById('generate');
    const clearButton = document.getElementById('clear');
    const result = document.getElementById('result');
    const mcpUrl = document.getElementById('mcpUrl');
    const error = document.getElementById('error');
    const copy = document.getElementById('copy');

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      error.textContent = '';
      result.style.display = 'none';
      generateButton.disabled = true;
      try {
        const body = {
          setupPassword: document.getElementById('setupPassword').value,
          wereadApiKey: document.getElementById('wereadApiKey').value
        };
        const response = await fetch('/api/generate-url', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body)
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || '生成失败');
        mcpUrl.textContent = data.mcpUrl;
        result.style.display = 'block';
      } catch (err) {
        error.textContent = err instanceof Error ? err.message : String(err);
      } finally {
        generateButton.disabled = false;
      }
    });

    clearButton.addEventListener('click', () => {
      form.reset();
      result.style.display = 'none';
      mcpUrl.textContent = '';
      error.textContent = '';
    });

    copy.addEventListener('click', async () => {
      await navigator.clipboard.writeText(mcpUrl.textContent || '');
      copy.textContent = '已复制';
      setTimeout(() => { copy.textContent = '复制 URL'; }, 1400);
    });
  </script>
</body>
</html>`;
}
