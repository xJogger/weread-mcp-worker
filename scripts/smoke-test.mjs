#!/usr/bin/env node
const url = process.argv[2];
if (!url) {
  console.error('Usage: node scripts/smoke-test.mjs https://<worker>/mcp/<encrypted-token>');
  process.exit(1);
}

async function rpc(method, params, id) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'accept': 'application/json, text/event-stream'
    },
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params })
  });
  const text = await response.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  if (!response.ok) {
    console.error('HTTP', response.status, json);
    process.exit(1);
  }
  return json;
}

console.log('initialize');
console.dir(await rpc('initialize', { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'smoke-test', version: '0.1.0' } }, 1), { depth: 8 });

await fetch(url, {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'accept': 'application/json, text/event-stream' },
  body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} })
});

console.log('tools/list');
const tools = await rpc('tools/list', {}, 2);
console.dir(tools, { depth: 5 });
