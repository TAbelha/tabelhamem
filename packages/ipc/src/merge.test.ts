import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync, lstatSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { planMerge, applyMerge } from './merge.js';
import { linkRepo, claudeMemoryDir, getSharedDir } from './store.js';

function put(path: string, content: string): void {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, content);
}

describe('merge sem perda', () => {
  let root: string;

  beforeEach(() => {
    root = join(tmpdir(), `tm-merge-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(root, { recursive: true });
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('classifica copy, identical, conflict e recursivo', () => {
    const a = join(root, 'a');
    const dst = join(root, 'dst');
    put(join(a, 'novo.md'), 'n');
    put(join(a, 'sub', 'fundo.md'), 'f');
    put(join(a, 'igual.md'), 'x');
    put(join(dst, 'igual.md'), 'x');
    put(join(a, 'dif.md'), 'da fonte');
    put(join(dst, 'dif.md'), 'do destino');

    const plan = planMerge([a], dst);
    expect(plan.copies.map((c) => c.rel).sort()).toEqual(['novo.md', join('sub', 'fundo.md')]);
    expect(plan.identical).toEqual(['igual.md']);
    expect(plan.conflicts).toEqual([{ rel: 'dif.md', sources: [join(dst, 'dif.md'), join(a, 'dif.md')] }]);
  });

  it('dst ausente conta como vazio', () => {
    const a = join(root, 'a');
    put(join(a, 'x.md'), 'x');
    const plan = planMerge([a], join(root, 'nao-existe'));
    expect(plan.copies.map((c) => c.rel)).toEqual(['x.md']);
    expect(existsSync(join(root, 'nao-existe'))).toBe(false);
  });

  it('MEMORY.md junta linhas novas mantendo a ordem do destino', () => {
    const a = join(root, 'a');
    const dst = join(root, 'dst');
    put(join(dst, 'MEMORY.md'), '- [A](a.md)\n- [B](b.md)\n');
    put(join(a, 'MEMORY.md'), '- [B](b.md)  \n\n- [C](c.md)\n- [A](a.md)\n');

    const plan = planMerge([a], dst);
    expect(plan.indexMerges).toEqual([{ rel: 'MEMORY.md', addedLines: ['- [C](c.md)'] }]);
    expect(plan.conflicts).toEqual([]);

    applyMerge(plan, dst);
    expect(readFileSync(join(dst, 'MEMORY.md'), 'utf-8')).toBe('- [A](a.md)\n- [B](b.md)\n- [C](c.md)\n');
  });

  it('pega conflito entre fontes (dst virtual)', () => {
    const a = join(root, 'a');
    const b = join(root, 'b');
    const dst = join(root, 'dst');
    put(join(a, 'x.md'), 'versão a');
    put(join(b, 'x.md'), 'versão b');
    put(join(a, 'y.md'), 'mesmo');
    put(join(b, 'y.md'), 'mesmo');

    const plan = planMerge([a, b], dst);
    expect(plan.conflicts).toEqual([{ rel: 'x.md', sources: [join(a, 'x.md'), join(b, 'x.md')] }]);
    expect(plan.copies.map((c) => c.rel).sort()).toEqual(['x.md', 'y.md']);
    expect(plan.identical).toEqual(['y.md']);
  });

  it('applyMerge copia sem sobrescrever e recusa plano com conflito', () => {
    const a = join(root, 'a');
    const dst = join(root, 'dst');
    put(join(a, 'sub', 'n.md'), 'n');
    put(join(a, 'd.md'), '1');
    put(join(dst, 'd.md'), '2');

    const plan = planMerge([a], dst);
    expect(() => applyMerge(plan, dst)).toThrow();
    expect(existsSync(join(dst, 'sub', 'n.md'))).toBe(false);

    const ok = planMerge([join(a, 'sub')], join(dst, 'sub'));
    applyMerge(ok, join(dst, 'sub'));
    expect(readFileSync(join(dst, 'sub', 'n.md'), 'utf-8')).toBe('n');
    expect(readFileSync(join(dst, 'd.md'), 'utf-8')).toBe('2');
  });
});

describe('regressão: link não perde arquivo conflitante', () => {
  let home: string;
  let realHome: string | undefined;
  let realCCD: string | undefined;

  beforeEach(() => {
    home = join(tmpdir(), `tm-mergelink-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    realHome = process.env.HOME;
    realCCD = process.env.CLAUDE_CONFIG_DIR;
    process.env.HOME = home;
    delete process.env.CLAUDE_CONFIG_DIR;
  });

  afterEach(() => {
    process.env.HOME = realHome;
    if (realCCD === undefined) delete process.env.CLAUDE_CONFIG_DIR;
    else process.env.CLAUDE_CONFIG_DIR = realCCD;
    rmSync(home, { recursive: true, force: true });
  });

  it('a.md diferente: mantém os dois e o dir continua real', () => {
    const repo = join(home, 'codigo', 'wiv', 'proj-a');
    mkdirSync(repo, { recursive: true });
    put(join(getSharedDir('proj-a'), 'a.md'), 'compartilhado');
    const md = claudeMemoryDir(repo);
    put(join(md, 'a.md'), 'local');
    put(join(md, 'b.md'), 'só local');

    linkRepo(repo, 'proj-a');

    expect(lstatSync(md).isSymbolicLink()).toBe(false);
    expect(readFileSync(join(md, 'a.md'), 'utf-8')).toBe('local');
    expect(readFileSync(join(md, 'b.md'), 'utf-8')).toBe('só local');
    expect(readFileSync(join(getSharedDir('proj-a'), 'a.md'), 'utf-8')).toBe('compartilhado');
  });
});
