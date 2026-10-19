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

  it('link nao cria .gitignore (nada tracked é tocado)', () => {
    linkRepo(repo, 'proj-a');
    linkRepo(repo, 'proj-a');

    expect(existsSync(join(repo, '.gitignore'))).toBe(false);
    expect(existsSync(join(repo, MEMORY_POINTER_FILE))).toBe(true);
  });

  it('link preserva .gitignore existente sem adicionar pointer', () => {
    writeFileSync(join(repo, '.gitignore'), 'node_modules/\n');
    linkRepo(repo, 'proj-a');

    const content = readFileSync(join(repo, '.gitignore'), 'utf-8');
    expect(content).toContain('node_modules/');
    expect(content.split('\n').map((l) => l.trim())).not.toContain(MEMORY_POINTER_FILE);
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

describe('link sem tocar tracked', () => {
  let home: string;
  let realHome: string | undefined;
  let repo: string;

  beforeEach(() => {
    home = join(tmpdir(), `tm-exclude-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    realHome = process.env.HOME;
    process.env.HOME = home;
    repo = join(home, 'codigo', 'wiv', 'proj-b');
    mkdirSync(repo, { recursive: true });
  });

  afterEach(() => {
    process.env.HOME = realHome;
    rmSync(home, { recursive: true, force: true });
  });

  it('link em repo git nao cria nem altera .gitignore', async () => {
    const { execSync } = await import('child_process');
    execSync('git init -q', { cwd: repo });
    execSync('git config user.email t@t.co', { cwd: repo });
    execSync('git config user.name t', { cwd: repo });
    writeFileSync(join(repo, '.gitignore'), 'node_modules/\n');
    execSync('git add -A && git commit -qm init', { cwd: repo });

    linkRepo(repo, 'proj-b');

    const content = readFileSync(join(repo, '.gitignore'), 'utf-8');
    expect(content).toContain('node_modules/');
    expect(content.split('\n').map((l) => l.trim())).not.toContain(MEMORY_POINTER_FILE);
    const status = execSync('git status --porcelain', { cwd: repo, encoding: 'utf-8' });
    expect(status.split('\n').some((l) => l.slice(3).trim() === '.gitignore')).toBe(false);
  });

  it('link ignora pointer via .git/info/exclude', async () => {
    const { execSync } = await import('child_process');
    execSync('git init -q', { cwd: repo });

    linkRepo(repo, 'proj-b');

    const exclude = readFileSync(join(repo, '.git', 'info', 'exclude'), 'utf-8');
    expect(exclude.split('\n').map((l) => l.trim())).toContain(MEMORY_POINTER_FILE);
    const ignored = execSync('git check-ignore -q .tabelhamem.md && echo yes || echo no', {
      cwd: repo,
      encoding: 'utf-8',
    }).trim();
    expect(ignored).toBe('yes');
  });

  it('link remove linha legada do .gitignore e preserva resto', async () => {
    const { execSync } = await import('child_process');
    execSync('git init -q', { cwd: repo });
    writeFileSync(join(repo, '.gitignore'), `node_modules/\n${MEMORY_POINTER_FILE}\n`);

    linkRepo(repo, 'proj-b');

    const content = readFileSync(join(repo, '.gitignore'), 'utf-8');
    expect(content).toContain('node_modules/');
    expect(content.split('\n').map((l) => l.trim())).not.toContain(MEMORY_POINTER_FILE);
  });
});
