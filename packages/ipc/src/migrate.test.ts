import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync, lstatSync, readdirSync, readlinkSync, symlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { migratePath, ipcMigrate } from './migrate.js';
import { claudeMemoryDir, getSharedDir, MEMORY_POINTER_FILE } from './store.js';

function put(path: string, content: string): void {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, content);
}

// Foto do disco (tipo + conteúdo/alvo) pra provar zero escrita.
function snapshot(dir: string): string[] {
  const out: string[] = [];
  const walk = (p: string) => {
    const st = lstatSync(p);
    if (st.isSymbolicLink()) out.push(`L ${p} -> ${readlinkSync(p)}`);
    else if (st.isDirectory()) {
      out.push(`D ${p}`);
      for (const n of readdirSync(p).sort()) walk(join(p, n));
    } else out.push(`F ${p} ${readFileSync(p, 'utf-8')}`);
  };
  walk(dir);
  return out;
}

describe('migrate', () => {
  let home: string;
  let realHome: string | undefined;
  let realCCD: string | undefined;
  let claude: string;
  let wiv: string;

  beforeEach(() => {
    home = join(tmpdir(), `tm-migrate-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    realHome = process.env.HOME;
    realCCD = process.env.CLAUDE_CONFIG_DIR;
    process.env.HOME = home;
    delete process.env.CLAUDE_CONFIG_DIR;
    claude = join(home, '.claude');
    wiv = join(home, '.claude-wiv');
    mkdirSync(join(claude, 'projects'), { recursive: true });
    mkdirSync(join(wiv, 'projects'), { recursive: true });
  });

  afterEach(() => {
    process.env.HOME = realHome;
    if (realCCD === undefined) delete process.env.CLAUDE_CONFIG_DIR;
    else process.env.CLAUDE_CONFIG_DIR = realCCD;
    rmSync(home, { recursive: true, force: true });
  });

  it('path fora de repo: migra, faz backup, liga todos e não cria pointer', () => {
    const dir = join(home, 'agent-workspace');
    mkdirSync(dir, { recursive: true });
    const md = claudeMemoryDir(dir, claude);
    put(join(md, 'a.md'), '# a');

    const r = migratePath(dir, 'workspace', { dryRun: false });

    expect(r.status).toBe('ok');
    expect(r.sources).toEqual([md]);
    expect(readFileSync(join(getSharedDir('workspace'), 'a.md'), 'utf-8')).toBe('# a');
    expect(lstatSync(md).isSymbolicLink()).toBe(true);
    expect(lstatSync(claudeMemoryDir(dir, wiv)).isSymbolicLink()).toBe(true);
    expect(r.linked.sort()).toEqual([md, claudeMemoryDir(dir, wiv)].sort());
    expect(r.backups).toHaveLength(1);
    expect(r.backups[0]).toMatch(/memory\.pre-tamem-\d{14}$/);
    expect(readFileSync(join(r.backups[0], 'a.md'), 'utf-8')).toBe('# a');
    expect(existsSync(join(dir, MEMORY_POINTER_FILE))).toBe(false);
  });

  it('path = HOME', () => {
    const md = claudeMemoryDir(home, claude);
    put(join(md, 'h.md'), 'h');

    const r = migratePath(home, 'home', { dryRun: false });

    expect(r.status).toBe('ok');
    expect(readFileSync(join(getSharedDir('home'), 'h.md'), 'utf-8')).toBe('h');
    expect(existsSync(join(home, MEMORY_POINTER_FILE))).toBe(false);
  });

  it('dry-run não escreve nada', () => {
    const dir = join(home, 'x');
    put(join(claudeMemoryDir(dir, claude), 'a.md'), 'a');
    put(join(claudeMemoryDir(dir, wiv), 'b.md'), 'b');
    const before = snapshot(home);

    const r = migratePath(dir, 'x', { dryRun: true });

    expect(r.status).toBe('dry-run');
    expect(r.plan.copies.map((c) => c.rel).sort()).toEqual(['a.md', 'b.md']);
    expect(snapshot(home)).toEqual(before);
  });

  it('arquivo idêntico vira identical e MEMORY.md junta linhas', () => {
    const dir = join(home, 'x');
    const shared = getSharedDir('x');
    put(join(shared, 'a.md'), 'igual');
    put(join(shared, 'MEMORY.md'), '- [A](a.md)\n');
    const md = claudeMemoryDir(dir, claude);
    put(join(md, 'a.md'), 'igual');
    put(join(md, 'MEMORY.md'), '- [A](a.md)\n- [B](b.md)\n');
    put(join(md, 'b.md'), 'b');

    const r = migratePath(dir, 'x', { dryRun: false });

    expect(r.status).toBe('ok');
    expect(r.plan.identical).toEqual(['a.md']);
    expect(readFileSync(join(shared, 'MEMORY.md'), 'utf-8')).toBe('- [A](a.md)\n- [B](b.md)\n');
    expect(readFileSync(join(shared, 'b.md'), 'utf-8')).toBe('b');
  });

  it('conflito não mexe em nada', () => {
    const dir = join(home, 'x');
    put(join(getSharedDir('x'), 'a.md'), 'compartilhado');
    put(join(claudeMemoryDir(dir, claude), 'a.md'), 'local');
    put(join(claudeMemoryDir(dir, claude), 'novo.md'), 'n');
    const before = snapshot(home);

    const r = migratePath(dir, 'x', { dryRun: false });

    expect(r.status).toBe('conflict');
    expect(r.plan.conflicts.map((c) => c.rel)).toEqual(['a.md']);
    expect(snapshot(home)).toEqual(before);
  });

  it('conflito entre ~/.claude e ~/.claude-wiv', () => {
    const dir = join(home, 'x');
    put(join(claudeMemoryDir(dir, claude), 'x.md'), 'conta 1');
    put(join(claudeMemoryDir(dir, wiv), 'x.md'), 'conta 2');
    const before = snapshot(home);

    const r = migratePath(dir, 'x', { dryRun: false });

    expect(r.status).toBe('conflict');
    expect(r.plan.conflicts).toEqual([
      { rel: 'x.md', sources: [join(claudeMemoryDir(dir, claude), 'x.md'), join(claudeMemoryDir(dir, wiv), 'x.md')] },
    ]);
    expect(snapshot(home)).toEqual(before);
  });

  it('symlink pra outro slug fica intocado (skipped)', () => {
    const dir = join(home, 'x');
    mkdirSync(getSharedDir('outro'), { recursive: true });
    const wivMd = claudeMemoryDir(dir, wiv);
    mkdirSync(join(wivMd, '..'), { recursive: true });
    symlinkSync(getSharedDir('outro'), wivMd);
    put(join(claudeMemoryDir(dir, claude), 'a.md'), 'a');

    const r = migratePath(dir, 'x', { dryRun: false });

    expect(r.status).toBe('ok');
    expect(r.skipped.map((s) => s.dir)).toEqual([wivMd]);
    expect(readlinkSync(wivMd)).toBe(getSharedDir('outro'));
    expect(r.linked).toEqual([claudeMemoryDir(dir, claude)]);
  });

  it('já ligado: idempotente, sem backup', () => {
    const dir = join(home, 'x');
    put(join(claudeMemoryDir(dir, claude), 'a.md'), 'a');
    migratePath(dir, 'x', { dryRun: false });

    const r = migratePath(dir, 'x', { dryRun: false });

    expect(r.status).toBe('ok');
    expect(r.sources).toEqual([]);
    expect(r.backups).toEqual([]);
    expect(r.linked).toHaveLength(2);
  });

  it('slug inválido é erro e não escreve nada', () => {
    const dir = join(home, 'x');
    put(join(claudeMemoryDir(dir, claude), 'a.md'), 'a');
    const before = snapshot(home);

    expect(migratePath(dir, '../evil', { dryRun: false }).status).toBe('error');
    expect(migratePath(dir, '_archive', { dryRun: false }).status).toBe('error');
    expect(snapshot(home)).toEqual(before);
  });

  it('ipcMigrate: exit codes e args obrigatórios', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const dir = join(home, 'x');
      put(join(claudeMemoryDir(dir, claude), 'a.md'), 'a');
      expect(ipcMigrate({ method: 'migrate', filters: { path: dir }, json: false })).toBe(1);
      expect(ipcMigrate({ method: 'migrate', filters: { project: 'x' }, json: false })).toBe(1);
      expect(ipcMigrate({ method: 'migrate', filters: { project: 'x', path: dir, 'dry-run': 'true' }, json: false })).toBe(0);
      expect(JSON.parse(log.mock.calls[0][0] as string).status).toBe('dry-run');
      expect(ipcMigrate({ method: 'migrate', filters: { project: '../evil', path: dir }, json: false })).toBe(1);
    } finally {
      log.mockRestore();
      err.mockRestore();
    }
  });
});
