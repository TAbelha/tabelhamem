#!/usr/bin/env bun
import { parseIPCArgs } from './parser.js';
import { runIPC } from './ipc.js';

const args = process.argv.slice(2);
const normalized = args[0] === 'ipc' ? args.slice(1) : args;

if (normalized.length === 0 || normalized[0] === 'tui') {
  // Abre a TUI interativa (OpenTUI + Solid) como processo filho herdando o
  // terminal. Sem import estático pra não criar ciclo ipc -> tui. O preload
  // do Solid vai explícito + cwd no pacote tui, porque o bunfig.toml de lá
  // só é descoberto quando o cwd está dentro do pacote.
  const tuiDir = new URL('../../tui/', import.meta.url).pathname;
  const main = new URL('../../tui/src/main.tsx', import.meta.url).pathname;
  const proc = Bun.spawn([process.execPath, 'run', '--preload', '@opentui/solid/preload', main], {
    stdio: ['inherit', 'inherit', 'inherit'],
    cwd: tuiDir,
  });
  process.exit(await proc.exited);
}

try {
  const parsed = parseIPCArgs(normalized);
  const exitCode = runIPC(parsed);
  process.exit(exitCode);
} catch (err) {
  console.error(err);
  process.exit(1);
}
