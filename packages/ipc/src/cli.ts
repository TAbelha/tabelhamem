#!/usr/bin/env bun
import { parseIPCArgs } from './parser.js';
import { runIPC } from './ipc.js';

const args = process.argv.slice(2);
const normalized = args[0] === 'ipc' ? args.slice(1) : args;

try {
  const parsed = parseIPCArgs(normalized);
  const exitCode = runIPC(parsed);
  process.exit(exitCode);
} catch (err) {
  console.error(err);
  process.exit(1);
}
