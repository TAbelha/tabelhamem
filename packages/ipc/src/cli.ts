#!/usr/bin/env bun
import { parseIPCArgs } from './parser.js';
import { runIPC } from './ipc.js';

const args = process.argv.slice(2);
const normalized = args[0] === 'ipc' ? args.slice(1) : args;

if (normalized.length === 0) {
  console.error('uso: tamem ipc <método> [key=value...] --json');
  console.error('métodos: global, link, unlink, status, list, search, health, search-digest');
  console.error('(a TUI interativa do tamem v1 foi descontinuada; use o plugin OpenCode ou o IPC)');
  process.exit(1);
}

try {
  const parsed = parseIPCArgs(normalized);
  const exitCode = runIPC(parsed);
  process.exit(exitCode);
} catch (err) {
  console.error(err);
  process.exit(1);
}
