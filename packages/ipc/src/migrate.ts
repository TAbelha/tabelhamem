import { existsSync, lstatSync, mkdirSync, renameSync, symlinkSync, readlinkSync } from 'fs';
import { dirname, isAbsolute, resolve } from 'path';
import type { IPCArgs } from './types.js';
import { claudeMemoryDirs, ensureSharedDir, getSharedDir } from './store.js';
import { IGNORED_MEMORY_DIRS } from './discover.js';
import { planMerge, applyMerge, type MergePlan } from './merge.js';

export interface MigrateResult {
  status: 'ok' | 'dry-run' | 'conflict' | 'error';
  sharedDir: string;
  sources: string[];
  plan: MergePlan;
  linked: string[];
  backups: string[];
  skipped: { dir: string; reason: string }[];
  error?: string;
}

const SLUG_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function emptyPlan(): MergePlan {
  return { copies: [], identical: [], indexMerges: [], conflicts: [] };
}

function linkTarget(p: string): string {
  const t = readlinkSync(p);
  return isAbsolute(t) ? t : resolve(dirname(p), t);
}

function timestamp(d = new Date()): string {
  const z = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}${z(d.getHours())}${z(d.getMinutes())}${z(d.getSeconds())}`;
}

// Nome de backup livre (sufixo -N se o do mesmo segundo já existir).
function backupPath(md: string, ts: string): string {
  const base = `${md}.pre-tamem-${ts}`;
  let p = base;
  for (let i = 1; existsSync(p); i++) p = `${base}-${i}`;
  return p;
}

// migratePath adota os dirs de memória reais do Claude Code (em todos os
// config dirs) pra um path qualquer — repo ou não, inclusive o HOME — no
// compartilhado ~/agent-memory/<slug>, e troca cada um por symlink. É
// tudo-ou-nada: com conflito nada muda. Os dirs originais viram backup
// (.pre-tamem-<ts>), nunca são apagados. Não toca em .tabelhamem.md,
// .git/info/exclude nem config: pra repo, rode `link` depois.
export function migratePath(pathAbs: string, slug: string, opts: { dryRun: boolean }): MigrateResult {
  const res: MigrateResult = {
    status: 'error',
    sharedDir: '',
    sources: [],
    plan: emptyPlan(),
    linked: [],
    backups: [],
    skipped: [],
  };

  if (!SLUG_RE.test(slug) || IGNORED_MEMORY_DIRS.has(slug)) {
    res.error = `slug inválido: ${slug}`;
    return res;
  }
  const shared = getSharedDir(slug);
  res.sharedDir = shared;
  const path = resolve(pathAbs);

  // Classifica cada dir de memória: real -> fonte; symlink pro compartilhado
  // -> já ligado; symlink pra outro lugar -> intocado; ausente -> liga.
  const toLink: string[] = [];
  for (const md of claudeMemoryDirs(path)) {
    let st;
    try {
      st = lstatSync(md);
    } catch {
      toLink.push(md);
      continue;
    }
    if (st.isSymbolicLink()) {
      const t = linkTarget(md);
      if (t === shared) res.linked.push(md);
      else res.skipped.push({ dir: md, reason: `symlink para ${t}` });
    } else if (st.isDirectory()) {
      res.sources.push(md);
      toLink.push(md);
    } else {
      res.skipped.push({ dir: md, reason: 'não é diretório nem symlink' });
    }
  }

  try {
    res.plan = planMerge(res.sources, shared);
  } catch (err) {
    res.error = `erro planejando merge: ${err}`;
    return res;
  }

  const ts = timestamp();
  if (opts.dryRun) {
    res.status = 'dry-run';
    res.backups = res.sources.map((md) => backupPath(md, ts));
    res.linked.push(...toLink);
    return res;
  }

  if (res.plan.conflicts.length > 0) {
    res.status = 'conflict';
    return res;
  }

  try {
    ensureSharedDir(slug);
    applyMerge(res.plan, shared);
    for (const md of res.sources) {
      const b = backupPath(md, ts);
      renameSync(md, b);
      res.backups.push(b);
    }
    for (const md of toLink) {
      mkdirSync(dirname(md), { recursive: true });
      symlinkSync(shared, md);
      res.linked.push(md);
    }
  } catch (err) {
    res.error = `erro aplicando migração: ${err}`;
    return res;
  }

  res.status = 'ok';
  return res;
}

export function ipcMigrate(args: IPCArgs): number {
  const { project, path } = args.filters;

  if (!project) {
    console.error('project= é obrigatório');
    return 1;
  }
  if (!path) {
    console.error('path= é obrigatório');
    return 1;
  }

  const res = migratePath(path, project, { dryRun: args.filters['dry-run'] === 'true' });
  console.log(JSON.stringify(res, null, 2));
  if (res.status === 'conflict') {
    console.error(`Conflitos: nada foi alterado. Resolva e rode de novo.`);
  }
  return res.status === 'ok' || res.status === 'dry-run' ? 0 : 1;
}
