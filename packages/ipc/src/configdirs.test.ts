import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync, lstatSync, symlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  claudeConfigDirs,
  claudeMemoryDir,
  claudeMemoryDirs,
  encodeProjectPath,
  getSharedDir,
  linkRepo,
  unlinkRepo,
} from './store.js';
import { discoverProjects, isRepoLinked, linkedConfigDirs } from './discover.js';
import { ipcStatus } from './status.js';

describe('múltiplos config dirs do Claude', () => {
  let home: string;
  let realHome: string | undefined;
  let realCCD: string | undefined;
  let repo: string;

  beforeEach(() => {
    home = join(tmpdir(), `tm-cfgdirs-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    realHome = process.env.HOME;
    realCCD = process.env.CLAUDE_CONFIG_DIR;
    process.env.HOME = home;
    delete process.env.CLAUDE_CONFIG_DIR;

    mkdirSync(join(home, '.claude'), { recursive: true });
    mkdirSync(join(home, '.claude-wiv', 'projects'), { recursive: true });
    // Sem projects/: não é config dir do Claude Code.
    mkdirSync(join(home, '.claude-monitor'), { recursive: true });
    writeFileSync(join(home, '.claude.json'), '{}');

    repo = join(home, 'codigo', 'wiv', 'proj-a');
    mkdirSync(repo, { recursive: true });
  });

  afterEach(() => {
    process.env.HOME = realHome;
    if (realCCD === undefined) delete process.env.CLAUDE_CONFIG_DIR;
    else process.env.CLAUDE_CONFIG_DIR = realCCD;
    rmSync(home, { recursive: true, force: true });
  });

  it('resolver ignora .claude-monitor e .claude.json', () => {
    expect(claudeConfigDirs()).toEqual([join(home, '.claude'), join(home, '.claude-wiv')]);
  });

  it('~/.claude entra mesmo sem existir', () => {
    rmSync(join(home, '.claude'), { recursive: true, force: true });
    expect(claudeConfigDirs()[0]).toBe(join(home, '.claude'));
  });

  it('CLAUDE_CONFIG_DIR vem primeiro e sem duplicata', () => {
    process.env.CLAUDE_CONFIG_DIR = join(home, '.claude-wiv') + '/';
    expect(claudeConfigDirs()).toEqual([join(home, '.claude-wiv'), join(home, '.claude')]);

    process.env.CLAUDE_CONFIG_DIR = join(home, 'outro');
    expect(claudeConfigDirs()).toEqual([join(home, 'outro'), join(home, '.claude'), join(home, '.claude-wiv')]);
  });

  it('codifica / e . como -', () => {
    expect(encodeProjectPath('/home/u/.claude-workspace')).toBe('-home-u--claude-workspace');
    expect(claudeMemoryDir('/home/u/x', join(home, '.claude-wiv'))).toBe(
      join(home, '.claude-wiv', 'projects', '-home-u-x', 'memory'),
    );
    expect(claudeMemoryDir('/home/u/x')).toBe(join(home, '.claude', 'projects', '-home-u-x', 'memory'));
  });

  it('link cria symlink em todos os config dirs', () => {
    linkRepo(repo, 'proj-a');
    const mds = claudeMemoryDirs(repo);
    expect(mds).toHaveLength(2);
    for (const md of mds) expect(lstatSync(md).isSymbolicLink()).toBe(true);
  });

  it('unlink restaura os dois e não cria o que não tinha symlink', () => {
    linkRepo(repo, 'proj-a');
    writeFileSync(join(getSharedDir('proj-a'), 'a.md'), '# a');
    unlinkRepo(repo, 'proj-a');
    for (const md of claudeMemoryDirs(repo)) {
      expect(lstatSync(md).isSymbolicLink()).toBe(false);
      expect(existsSync(join(md, 'a.md'))).toBe(true);
    }

    // Só o ~/.claude-wiv ligado: unlink não cria nada em ~/.claude.
    const repo2 = join(home, 'codigo', 'wiv', 'proj-b');
    mkdirSync(repo2, { recursive: true });
    mkdirSync(getSharedDir('proj-b'), { recursive: true });
    const wivMd = claudeMemoryDir(repo2, join(home, '.claude-wiv'));
    mkdirSync(join(wivMd, '..'), { recursive: true });
    symlinkSync(getSharedDir('proj-b'), wivMd);
    unlinkRepo(repo2, 'proj-b');
    expect(lstatSync(wivMd).isDirectory()).toBe(true);
    expect(existsSync(claudeMemoryDir(repo2))).toBe(false);
  });

  it('descoberta acha slug ligado só no ~/.claude-wiv', () => {
    const r = join(home, 'codigo', 'tabelhadev', 'radar');
    mkdirSync(r, { recursive: true });
    mkdirSync(getSharedDir('radar'), { recursive: true });
    const wivMd = claudeMemoryDir(r, join(home, '.claude-wiv'));
    mkdirSync(join(wivMd, '..'), { recursive: true });
    symlinkSync(getSharedDir('radar'), wivMd);

    const all = discoverProjects([join(home, 'codigo', 'wiv')]);
    const p = all.find((x) => x.slug === 'radar')!;
    expect(p.repo).toBe(r);
    expect(p.linked).toBe(true);
    expect(p.memoryOnly).toBe(false);
  });

  it('isRepoLinked vale quando só o wiv está ligado', () => {
    mkdirSync(getSharedDir('proj-a'), { recursive: true });
    expect(isRepoLinked(repo, getSharedDir('proj-a'))).toBe(false);
    const wivMd = claudeMemoryDir(repo, join(home, '.claude-wiv'));
    mkdirSync(join(wivMd, '..'), { recursive: true });
    symlinkSync(getSharedDir('proj-a'), wivMd);
    expect(isRepoLinked(repo, getSharedDir('proj-a'))).toBe(true);
    expect(linkedConfigDirs(repo, getSharedDir('proj-a'))).toEqual([join(home, '.claude-wiv')]);
  });

  it('status com repo= lista os config dirs ligados', () => {
    linkRepo(repo, 'proj-a');
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      expect(ipcStatus({ method: 'status', filters: { project: 'proj-a', repo }, json: true })).toBe(0);
      const out = JSON.parse(spy.mock.calls[0][0] as string);
      expect(out.claudeLinked).toBe(true);
      expect(out.claudeLinkedDirs).toEqual([join(home, '.claude'), join(home, '.claude-wiv')]);
    } finally {
      spy.mockRestore();
    }
  });
});
