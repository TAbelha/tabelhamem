import { existsSync, readdirSync, lstatSync, readlinkSync } from 'fs';
import { join, basename, dirname, resolve, isAbsolute, sep } from 'path';
import { homedir } from 'os';
import { getSharedDir, getTopicCount, claudeMemoryDir, hasAgentsSectionAt } from './store.js';
import type { DiscoveredProject } from './types.js';

// Diretórios sob ~/agent-memory que nunca são projetos.
export const IGNORED_MEMORY_DIRS = new Set(['_archive']);

// Raízes de código varridas pela descoberta de projetos.
export function defaultCodeRoots(): string[] {
  return ['ea', 'wiv', 'tabelha', 'ufmg', 'pessoal', 'cpdq'].map((d) => join(homedir(), 'codigo', d));
}

function symlinkTarget(linkPath: string): string | null {
  try {
    if (!lstatSync(linkPath).isSymbolicLink()) return null;
    const t = readlinkSync(linkPath);
    return isAbsolute(t) ? t : resolve(dirname(linkPath), t);
  } catch {
    return null;
  }
}

export function isRepoLinked(repo: string, shared: string): boolean {
  return symlinkTarget(claudeMemoryDir(repo)) === shared;
}

export function hasAgentsSection(repo: string): boolean {
  return hasAgentsSectionAt(repo);
}

// symlinks ativos do Claude Code que apontam pra dentro de ~/agent-memory:
// slug -> caminho do dir de memória do Claude (o próprio symlink).
function claudeLinkedSlugs(): Map<string, string> {
  const out = new Map<string, string>();
  const base = join(homedir(), '.claude', 'projects');
  if (!existsSync(base)) return out;
  const prefix = join(homedir(), 'agent-memory') + sep;
  for (const e of readdirSync(base, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const target = symlinkTarget(join(base, e.name, 'memory'));
    if (target && target.startsWith(prefix)) {
      out.set(basename(target), join(base, e.name, 'memory'));
    }
  }
  return out;
}

// Localiza um repo pelo basename em ~/codigo/<org>/<slug>. Usado só pra
// slugs que já têm ponte ativa (symlink do Claude), pra não perder o l/u
// de projetos fora das raízes varridas.
function findRepoBySlug(slug: string): string | null {
  const code = join(homedir(), 'codigo');
  if (!existsSync(code)) return null;
  for (const org of readdirSync(code, { withFileTypes: true })) {
    if (!org.isDirectory() || org.name.startsWith('.')) continue;
    const cand = join(code, org.name, slug);
    try {
      if (lstatSync(cand).isDirectory()) return cand;
    } catch {
      continue;
    }
  }
  return null;
}

function pushRepo(out: DiscoveredProject[], repo: string, slug: string): void {
  const shared = getSharedDir(slug);
  out.push({
    slug,
    org: basename(dirname(repo)),
    repo,
    sharedDir: shared,
    topicCount: getTopicCount(slug),
    linked: isRepoLinked(repo, shared),
    agentsSection: hasAgentsSection(repo),
    memoryOnly: false,
  });
}

// discoverProjects lista os repos encontrados nas raízes de código,
// agrupáveis por org (basename da raiz), mais os slugs de memória sem repo
// correspondente (org vazia). Ordenado por org + slug.
export function discoverProjects(roots: string[] = defaultCodeRoots()): DiscoveredProject[] {
  const out: DiscoveredProject[] = [];
  const seen = new Set<string>();

  for (const root of roots) {
    if (!existsSync(root)) continue;
    let entries;
    try {
      entries = readdirSync(root, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      if (!e.isDirectory() || e.name.startsWith('.')) continue;
      const repo = join(root, e.name);
      const slug = e.name;
      pushRepo(out, repo, slug);
      seen.add(slug);
    }
  }

  // Slugs já ligados (symlink ativo do Claude) entram com repo resolvido
  // mesmo fora das raízes, pra não perder o l/u. O resto vira memória.
  const linked = claudeLinkedSlugs();
  const memRoot = join(homedir(), 'agent-memory');
  if (existsSync(memRoot)) {
    for (const e of readdirSync(memRoot, { withFileTypes: true })) {
      if (!e.isDirectory() || e.name.startsWith('.') || IGNORED_MEMORY_DIRS.has(e.name)) continue;
      if (seen.has(e.name)) continue;
      seen.add(e.name);
      if (linked.has(e.name)) {
        const repo = findRepoBySlug(e.name);
        if (repo) {
          pushRepo(out, repo, e.name);
          continue;
        }
      }
      out.push({
        slug: e.name,
        org: '',
        repo: '',
        sharedDir: getSharedDir(e.name),
        topicCount: getTopicCount(e.name),
        linked: false,
        agentsSection: false,
        memoryOnly: true,
      });
    }
  }

  out.sort((a, b) => a.org.localeCompare(b.org) || a.slug.localeCompare(b.slug));
  return out;
}
