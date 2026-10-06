import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync, lstatSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  linkRepo,
  unlinkRepo,
  hasAgentsSectionAt,
  claudeMemoryDir,
  MEMORY_POINTER_FILE,
  AGENTS_MARKER_START,
} from './store.js';

describe('pointer file', () => {
  let home: string;
  let realHome: string | undefined;
  let repo: string;

  beforeEach(() => {
    home = join(tmpdir(), `tm-pointer-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    realHome = process.env.HOME;
    process.env.HOME = home;
    repo = join(home, 'codigo', 'wiv', 'proj-a');
    mkdirSync(repo, { recursive: true });
  });

  afterEach(() => {
    process.env.HOME = realHome;
    rmSync(home, { recursive: true, force: true });
  });

  it('link cria pointer e não toca no AGENTS.md', () => {
    linkRepo(repo, 'proj-a');

    const pointer = join(repo, MEMORY_POINTER_FILE);
    expect(existsSync(pointer)).toBe(true);
    expect(readFileSync(pointer, 'utf-8')).toContain(AGENTS_MARKER_START);
    expect(existsSync(join(repo, 'AGENTS.md'))).toBe(false);
    expect(lstatSync(claudeMemoryDir(repo)).isSymbolicLink()).toBe(true);
  });

  it('link registra o pointer no .gitignore de forma idempotente', () => {
    linkRepo(repo, 'proj-a');
    linkRepo(repo, 'proj-a');

    const lines = readFileSync(join(repo, '.gitignore'), 'utf-8').split('\n');
    expect(lines.filter((l) => l.trim() === MEMORY_POINTER_FILE)).toHaveLength(1);
  });

  it('link preserva .gitignore existente', () => {
    writeFileSync(join(repo, '.gitignore'), 'node_modules/\n');
    linkRepo(repo, 'proj-a');

    const content = readFileSync(join(repo, '.gitignore'), 'utf-8');
    expect(content).toContain('node_modules/');
    expect(content).toContain(MEMORY_POINTER_FILE);
  });

  it('unlink remove o pointer', () => {
    linkRepo(repo, 'proj-a');
    unlinkRepo(repo, 'proj-a');

    expect(existsSync(join(repo, MEMORY_POINTER_FILE))).toBe(false);
    expect(lstatSync(claudeMemoryDir(repo)).isSymbolicLink()).toBe(false);
  });

  it('link limpa bloco legado e deleta AGENTS.md espúrio', () => {
    writeFileSync(
      join(repo, 'AGENTS.md'),
      `${AGENTS_MARKER_START}\nlegado\n${'<!-- tabelhamem:end -->'}\n`
    );

    linkRepo(repo, 'proj-a');

    expect(existsSync(join(repo, 'AGENTS.md'))).toBe(false);
    expect(existsSync(join(repo, MEMORY_POINTER_FILE))).toBe(true);
  });

  it('link limpa bloco legado mas mantém o resto do AGENTS.md', () => {
    writeFileSync(
      join(repo, 'AGENTS.md'),
      `# Projeto\n\n${AGENTS_MARKER_START}\nlegado\n${'<!-- tabelhamem:end -->'}\n`
    );

    linkRepo(repo, 'proj-a');

    const content = readFileSync(join(repo, 'AGENTS.md'), 'utf-8');
    expect(content).toContain('# Projeto');
    expect(content).not.toContain(AGENTS_MARKER_START);
  });

  it('hasAgentsSectionAt vale pro pointer e pro legado', () => {
    expect(hasAgentsSectionAt(repo)).toBe(false);

    linkRepo(repo, 'proj-a');
    expect(hasAgentsSectionAt(repo)).toBe(true);

    unlinkRepo(repo, 'proj-a');
    expect(hasAgentsSectionAt(repo)).toBe(false);

    writeFileSync(join(repo, 'AGENTS.md'), `${AGENTS_MARKER_START}\nlegado\n${'<!-- tabelhamem:end -->'}\n`);
    expect(hasAgentsSectionAt(repo)).toBe(true);
  });
});
