import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import { mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir, homedir } from 'os';
import { resolveSlug } from './opencode.js';

describe('resolveSlug', () => {
  let base: string;

  beforeEach(() => {
    base = join(tmpdir(), `tm-slug-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(base, { recursive: true });
  });

  afterEach(() => {
    rmSync(base, { recursive: true, force: true });
  });

  it('dir sem git usa o basename', () => {
    const dir = join(base, 'plain');
    mkdirSync(dir, { recursive: true });
    expect(resolveSlug(dir)).toBe('plain');
  });

  it('subdir de repo usa o basename do checkout principal', () => {
    const repo = join(base, 'myrepo');
    mkdirSync(join(repo, 'sub', 'dir'), { recursive: true });
    execSync('git init -q', { cwd: repo });
    execSync('git config user.email t@t', { cwd: repo });
    execSync('git config user.name t', { cwd: repo });
    execSync('git commit -q --allow-empty -m init', { cwd: repo });
    expect(resolveSlug(join(repo, 'sub', 'dir'))).toBe('myrepo');
  });

  it('worktree linkado usa o basename do checkout principal', () => {
    const repo = join(base, 'mainrepo');
    mkdirSync(repo, { recursive: true });
    execSync('git init -q', { cwd: repo });
    execSync('git config user.email t@t', { cwd: repo });
    execSync('git config user.name t', { cwd: repo });
    execSync('git commit -q --allow-empty -m init', { cwd: repo });
    const wt = join(base, 'bs-1028-feature-x');
    execSync(`git worktree add -q --detach "${wt}"`, { cwd: repo });
    expect(resolveSlug(wt)).toBe('mainrepo');
  });

  it('home vira global', () => {
    expect(resolveSlug(homedir())).toBe('global');
  });
});
