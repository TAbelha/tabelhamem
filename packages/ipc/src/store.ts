import { execSync } from 'child_process';
import { existsSync, symlinkSync, mkdirSync, readFileSync, writeFileSync, rmSync, readdirSync, lstatSync, readlinkSync, renameSync } from 'fs';
import { join, dirname, resolve, isAbsolute } from 'path';
import { homedir } from 'os';

export const AGENTS_MARKER_START = '<!-- tabelhamem:start -->';
export const AGENTS_MARKER_END = '<!-- tabelhamem:end -->';

export function getSharedDir(slug: string): string {
  return join(homedir(), 'agent-memory', slug);
}

export function ensureSharedDir(slug: string): string {
  const dir = getSharedDir(slug);
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function getTopicCount(slug: string): number {
  const dir = getSharedDir(slug);
  if (!existsSync(dir)) return 0;
  return readdirSync(dir).filter(f => f.endsWith('.md')).length;
}

export function claudeMemoryDir(repoAbs: string): string {
  const encoded = repoAbs.replace(/\//g, '-').replace(/\./g, '-');
  return join(homedir(), '.claude', 'projects', encoded, 'memory');
}

export function ensureClaudeSymlink(slug: string, sharedDir: string): void {
  const repo = getRepoFromConfig(slug);
  if (!repo) return;

  const claudeDir = claudeMemoryDir(repo);
  const claudeParent = join(claudeDir, '..');

  mkdirSync(claudeParent, { recursive: true });

  if (existsSync(claudeDir)) {
    const stats = readFileSync(claudeDir, 'utf-8');
    if (stats.includes(sharedDir)) return;
  }

  try {
    rmSync(claudeDir, { recursive: true, force: true });
    symlinkSync(sharedDir, claudeDir);
  } catch (err) {
    console.error(`Erro criando symlink: ${err}`);
  }
}

export function removeClaudeSymlink(slug: string): void {
  const repo = getRepoFromConfig(slug);
  if (!repo) return;

  const claudeDir = claudeMemoryDir(repo);
  if (existsSync(claudeDir)) {
    rmSync(claudeDir, { recursive: true, force: true });
  }
}

export function checkClaudeSymlink(slug: string): boolean {
  const repo = getRepoFromConfig(slug);
  if (!repo) return false;

  const claudeDir = claudeMemoryDir(repo);
  if (!existsSync(claudeDir)) return false;

  try {
    const target = readFileSync(claudeDir, 'utf-8');
    return target.includes(getSharedDir(slug));
  } catch {
    return false;
  }
}

export function ensureAgentsSection(slug: string, sharedDir: string): void {
  const repo = getRepoFromConfig(slug);
  if (!repo) return;
  ensureAgentsSectionAt(repo, slug, sharedDir);
}

export function ensureAgentsSectionAt(repoAbs: string, slug: string, sharedDir: string): void {
  const agentsPath = join(repoAbs, 'AGENTS.md');
  const section = buildAgentsSection(slug, sharedDir);

  if (existsSync(agentsPath)) {
    const content = readFileSync(agentsPath, 'utf-8');
    if (content.includes(AGENTS_MARKER_START)) {
      const newContent = content.replace(
        new RegExp(`${AGENTS_MARKER_START}[\\s\\S]*?${AGENTS_MARKER_END}`),
        section.trim()
      );
      writeFileSync(agentsPath, newContent);
    } else {
      writeFileSync(agentsPath, content + '\n\n' + section);
    }
  } else {
    writeFileSync(agentsPath, section);
  }
}

export function removeAgentsSection(slug: string): void {
  const repo = getRepoFromConfig(slug);
  if (!repo) return;
  removeAgentsSectionAt(repo);
}

export function removeAgentsSectionAt(repoAbs: string): void {
  const agentsPath = join(repoAbs, 'AGENTS.md');
  if (!existsSync(agentsPath)) return;

  const content = readFileSync(agentsPath, 'utf-8');
  if (content.includes(AGENTS_MARKER_START)) {
    const newContent = content.replace(
      new RegExp(`${AGENTS_MARKER_START}[\\s\\S]*?${AGENTS_MARKER_END}\\n?`),
      ''
    );
    writeFileSync(agentsPath, newContent);
  }
}

export function checkAgentsSection(slug: string): boolean {
  const repo = getRepoFromConfig(slug);
  if (!repo) return false;

  const agentsPath = join(repo, 'AGENTS.md');
  if (!existsSync(agentsPath)) return false;

  const content = readFileSync(agentsPath, 'utf-8');
  return content.includes(AGENTS_MARKER_START);
}

function buildAgentsSection(slug: string, sharedDir: string): string {
  return `${AGENTS_MARKER_START}
## Memória Compartilhada

Este projeto usa memória compartilhada em \`${sharedDir}\`.

Instruções:
- Leia \`${sharedDir}/\` no início da sessão
- Escreva resumos da sessão no final
- Use \`tamem ipc search\` para buscar memória
${AGENTS_MARKER_END}`;
}

function getRepoFromConfig(slug: string): string | null {
  try {
    const configPath = join(homedir(), '.config', 'tabelhamem', 'config.toml');
    if (!existsSync(configPath)) return null;

    const content = readFileSync(configPath, 'utf-8');
    const lines = content.split('\n');
    let inProject = false;

    for (const line of lines) {
      if (line.startsWith('[[')) {
        inProject = line.includes(`slug = "${slug}"`);
      } else if (inProject && line.startsWith('repo =')) {
        return line.split('=')[1].trim().replace(/"/g, '');
      }
    }
  } catch {
    return null;
  }
  return null;
}

export function gitWorktrees(repo: string): string[] {
  try {
    const out = execSync('git worktree list --porcelain', { cwd: repo, encoding: 'utf-8' });
    const paths: string[] = [];
    for (const line of out.split('\n')) {
      if (line.startsWith('worktree ')) {
        paths.push(line.replace('worktree ', ''));
      }
    }
    return paths.length > 0 ? paths : [repo];
  } catch {
    return [repo];
  }
}

// linkRepo liga um repo explícito à memória compartilhada do slug: migra
// arquivos de memória já existentes no dir do Claude Code para o
// compartilhado (sem sobrescrever), cria o symlink e escreve a seção no
// AGENTS.md. Opera em todos os worktrees do repo. Idempotente.
export function linkRepo(repoAbs: string, slug: string): void {
  const shared = ensureSharedDir(slug);
  for (const wt of gitWorktrees(repoAbs)) {
    migrateAndLink(claudeMemoryDir(wt), shared);
    ensureAgentsSectionAt(wt, slug, shared);
  }
}

// unlinkRepo desfaz o link de um repo explícito: o diretório de memória do
// Claude Code volta a ter uma cópia real do conteúdo compartilhado (o
// compartilhado não é tocado) e a seção do AGENTS.md é removida.
export function unlinkRepo(repoAbs: string, slug: string): void {
  const shared = getSharedDir(slug);
  for (const wt of gitWorktrees(repoAbs)) {
    const cmd = claudeMemoryDir(wt);
    try {
      if (lstatSync(cmd).isSymbolicLink()) rmSync(cmd);
    } catch { /* não era symlink */ }
    if (existsSync(shared)) {
      mkdirSync(cmd, { recursive: true });
      copyMerge(shared, cmd);
    }
    removeAgentsSectionAt(wt);
  }
}

function symlinkPointsTo(linkPath: string, target: string): boolean {
  try {
    if (!lstatSync(linkPath).isSymbolicLink()) return false;
    const t = readlinkSync(linkPath);
    return (isAbsolute(t) ? t : resolve(dirname(linkPath), t)) === target;
  } catch {
    return false;
  }
}

function migrateAndLink(claudeDir: string, shared: string): void {
  mkdirSync(join(claudeDir, '..'), { recursive: true });
  try {
    const st = lstatSync(claudeDir);
    if (st.isSymbolicLink()) {
      rmSync(claudeDir);
    } else if (st.isDirectory()) {
      for (const f of readdirSync(claudeDir)) {
        const dst = join(shared, f);
        if (!existsSync(dst)) renameSync(join(claudeDir, f), dst);
      }
      rmSync(claudeDir, { recursive: true, force: true });
    }
  } catch { /* não existia, segue */ }
  if (!symlinkPointsTo(claudeDir, shared)) {
    try {
      symlinkSync(shared, claudeDir);
    } catch (err) {
      console.error(`Erro criando symlink: ${err}`);
    }
  }
}

function copyMerge(src: string, dst: string): void {
  for (const f of readdirSync(src, { withFileTypes: true })) {
    const s = join(src, f.name);
    const d = join(dst, f.name);
    if (f.isDirectory()) {
      mkdirSync(d, { recursive: true });
      copyMerge(s, d);
    } else if (!existsSync(d)) {
      writeFileSync(d, readFileSync(s));
    }
  }
}
