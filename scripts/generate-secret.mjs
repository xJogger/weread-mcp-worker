#!/usr/bin/env node
import { randomBytes, createHash } from 'node:crypto';

const mode = process.argv[2] || 'secret';

if (mode === 'sha256') {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const input = Buffer.concat(chunks).toString('utf8').replace(/\r?\n$/, '');
  process.stdout.write(createHash('sha256').update(input).digest('hex') + '\n');
} else {
  process.stdout.write(randomBytes(32).toString('base64url') + '\n');
}
