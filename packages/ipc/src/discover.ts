import { existsSync, readdirSync, lstatSync, readlinkSync, readFileSync } from 'fs';
import { join, basename, dirname, resolve, isAbsolute } from 'path';
import { homedir } from 'os';
import { getSharedDir, getTopicCount, claudeMemoryDir, AGENTS_MARKER_START } from './store.js';
import type { DiscoveredProject } from './types.js';

// Diretórios sob ~/agent-memory que nunca são projetos.
export const IGNORED_MEMORY_DIRS = new Set(['_archive']);

// Raízes de código varridas pela descoberta de projetos.
export function defaultCodeRoots(): string[] {
  return ['ea', 'wiv', 'tabelha', 'tabelhadev', 'ufmg', 'pessoal', 'cpdq'].map((d) =>
    join(homedir(), 'codigo', d),
  );
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
  try {
    return readFileSync(join(repo, 'AGENTS.md'), 'utf-8').includes(AGENTS_MARKER_START);
  } catch {
    return false;
  }
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
    const org = basename(root);
    for (const e of entries) {
      if (!e.isDirectory() || e.name.startsWith('.')) continue;
      const repo = join(root, e.name);
      const slug = e.name;
      const shared = getSharedDir(slug);
      out.push({
        slug,
        org,
        repo,
        sharedDir: shared,
        topicCount: getTopicCount(slug),
        linked: isRepoLinked(repo, shared),
        agentsSection: hasAgentsSection(repo),
        memoryOnly: false,
      });
      seen.add(slug);
    }
  }

  const memRoot = join(homedir(), 'agent-memory');
  if (existsSync(memRoot)) {
    for (const e of readdirSync(memRoot, { withFileTypes: true })) {
      if (!e.isDirectory() || e.name.startsWith('.') || IGNORED_MEMORY_DIRS.has(e.name)) continue;
      if (seen.has(e.name)) continue;
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
