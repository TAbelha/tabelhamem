import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync, lstatSync, readFileSync, symlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { discoverProjects } from './discover.js';
import { linkRepo, unlinkRepo, getSharedDir, claudeMemoryDir } from './store.js';

describe('discover', () => {
  let home: string;
  let realHome: string | undefined;

  beforeEach(() => {
    home = join(tmpdir(), `tm-discover-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    realHome = process.env.HOME;
    process.env.HOME = home;

    mkdirSync(join(home, 'codigo', 'wiv', 'proj-a', '.git'), { recursive: true });
    mkdirSync(join(home, 'codigo', 'ea', 'proj-b'), { recursive: true });

    mkdirSync(join(home, 'agent-memory', 'proj-a'), { recursive: true });
    writeFileSync(join(home, 'agent-memory', 'proj-a', 'feedback_x.md'), '# x');
    mkdirSync(join(home, 'agent-memory', '.git'), { recursive: true });
    mkdirSync(join(home, 'agent-memory', '_archive'), { recursive: true });
    mkdirSync(join(home, 'agent-memory', 'orphan'), { recursive: true });
  });

  afterEach(() => {
    process.env.HOME = realHome;
    rmSync(home, { recursive: true, force: true });
  });

  it('agrupa por org e filtra .git/_archive', () => {
    const all = discoverProjects([join(home, 'codigo', 'wiv'), join(home, 'codigo', 'ea')]);
    const slugs = all.map((p) => `${p.org}/${p.slug}`);

    expect(slugs).toContain('wiv/proj-a');
    expect(slugs).toContain('ea/proj-b');
    expect(slugs).toContain('/orphan');
    expect(slugs.some((s) => s.includes('.git') || s.includes('_archive'))).toBe(false);

    const a = all.find((p) => p.slug === 'proj-a')!;
    expect(a.topicCount).toBe(1);
    expect(a.linked).toBe(false);
    expect(a.memoryOnly).toBe(false);

    const o = all.find((p) => p.slug === 'orphan')!;
    expect(o.memoryOnly).toBe(true);
  });

  it('linkRepo cria symlink + AGENTS.md, unlinkRepo restaura cópia', () => {
    const repo = join(home, 'codigo', 'wiv', 'proj-a');

    linkRepo(repo, 'proj-a');
    expect(lstatSync(claudeMemoryDir(repo)).isSymbolicLink()).toBe(true);
    expect(readFileSync(join(repo, 'AGENTS.md'), 'utf-8')).toContain('tabelhamem:start');

    unlinkRepo(repo, 'proj-a');
    expect(lstatSync(claudeMemoryDir(repo)).isSymbolicLink()).toBe(false);
    expect(existsSync(join(claudeMemoryDir(repo), 'feedback_x.md'))).toBe(true);
    expect(existsSync(join(getSharedDir('proj-a'), 'feedback_x.md'))).toBe(true);
    expect(readFileSync(join(repo, 'AGENTS.md'), 'utf-8')).not.toContain('tabelhamem:start');
  });

  it('linkRepo migra arquivos pré-existentes sem sobrescrever', () => {
    const repo = join(home, 'codigo', 'wiv', 'proj-a');
    const cmd = claudeMemoryDir(repo);

    mkdirSync(cmd, { recursive: true });
    writeFileSync(join(cmd, 'old.md'), '# antigo');

    linkRepo(repo, 'proj-a');
    expect(existsSync(join(getSharedDir('proj-a'), 'old.md'))).toBe(true);
    expect(lstatSync(cmd).isSymbolicLink()).toBe(true);
  });

  it('slugs ligados fora das raízes entram com repo resolvido', () => {
    const repo = join(home, 'codigo', 'tabelhadev', 'radar');
    mkdirSync(repo, { recursive: true });
    mkdirSync(join(home, 'agent-memory', 'radar'), { recursive: true });

    const cmd = claudeMemoryDir(repo);
    mkdirSync(join(cmd, '..'), { recursive: true });
    symlinkSync(getSharedDir('radar'), cmd);

    const all = discoverProjects([join(home, 'codigo', 'wiv')]);
    const r = all.find((p) => p.slug === 'radar')!;
    expect(r.org).toBe('tabelhadev');
    expect(r.repo).toBe(repo);
    expect(r.linked).toBe(true);
    expect(r.memoryOnly).toBe(false);
  });
});
