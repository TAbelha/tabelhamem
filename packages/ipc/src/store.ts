import { execSync } from 'child_process';
import { existsSync, symlinkSync, mkdirSync, readFileSync, writeFileSync, rmSync, readdirSync, lstatSync, readlinkSync, statSync } from 'fs';
import { join, dirname, resolve, isAbsolute } from 'path';
import { homedir } from 'os';
import { planMerge, applyMerge } from './merge.js';

export const AGENTS_MARKER_START = '<!-- tabelhamem:start -->';
export const AGENTS_MARKER_END = '<!-- tabelhamem:end -->';

// Arquivo próprio da ponte dentro de cada repo. O bloco de instruções mora
// aqui em vez do AGENTS.md: o link nunca cria nem edita AGENTS.md, então
// nunca nasce um AGENTS.md espúrio por causa do tamem.
export const MEMORY_POINTER_FILE = '.tabelhamem.md';

export function getSharedDir(slug: string): string {
  return join(process.env.HOME || homedir(), 'agent-memory', slug);
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

// encodeProjectPath reproduz a codificação do Claude Code pro nome do dir
// em projects/: todo '/' e '.' vira '-'.
export function encodeProjectPath(pathAbs: string): string {
  return pathAbs.replace(/[\/.]/g, '-');
}

// claudeConfigDirs lista os config dirs do Claude Code, em ordem e sem
// duplicata (por resolve): $CLAUDE_CONFIG_DIR (se setado, mesmo sem
// projects/), ~/.claude (sempre) e cada diretório ~/.claude-* que tenha
// projects/, ordenados. ~/.claude-monitor (sem projects/) e o arquivo
// ~/.claude.json ficam de fora.
export function claudeConfigDirs(): string[] {
  const home = process.env.HOME || homedir();
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (d: string) => {
    const r = resolve(d);
    if (seen.has(r)) return;
    seen.add(r);
    out.push(r);
  };

  if (process.env.CLAUDE_CONFIG_DIR) add(process.env.CLAUDE_CONFIG_DIR);
  add(join(home, '.claude'));

  let names: string[] = [];
  try {
    names = readdirSync(home).filter((n) => n.startsWith('.claude-')).sort();
  } catch { /* HOME ausente */ }
  for (const n of names) {
    try {
      if (statSync(join(home, n)).isDirectory() && statSync(join(home, n, 'projects')).isDirectory()) {
        add(join(home, n));
      }
    } catch { /* sem projects/ */ }
  }
  return out;
}

// claudeMemoryDir é o dir de memória do Claude Code pra um path absoluto
// dentro de um config dir (padrão ~/.claude, pra compat dos chamadores).
export function claudeMemoryDir(pathAbs: string, configDir: string = join(process.env.HOME || homedir(), '.claude')): string {
  return join(configDir, 'projects', encodeProjectPath(pathAbs), 'memory');
}

// claudeMemoryDirs é o dir de memória do path em cada config dir.
export function claudeMemoryDirs(pathAbs: string): string[] {
  return claudeConfigDirs().map((d) => claudeMemoryDir(pathAbs, d));
}

export function ensureClaudeSymlink(slug: string, sharedDir: string): void {
  const repo = getRepoFromConfig(slug);
  if (!repo) return;

  const claudeDir = claudeMemoryDir(repo);
  const claudeParent = join(claudeDir, '..');

  mkdirSync(claudeParent, { recursive: true });

  if (existsSync(claudeDir)) {
    try {
      const stats = readFileSync(claudeDir, 'utf-8');
      if (stats.includes(sharedDir)) return;
    } catch {
      // Diretório real (não symlink): não remove nem migra por aqui, só
      // evita o crash do readFileSync em diretório (EISDIR).
      return;
    }
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

  // Só remove se for symlink: nunca apaga um diretório real com conteúdo.
  const claudeDir = claudeMemoryDir(repo);
  try {
    if (lstatSync(claudeDir).isSymbolicLink()) {
      rmSync(claudeDir, { recursive: true, force: true });
    }
  } catch { /* ausente, nada a fazer */ }
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
  writePointerFile(repoAbs, slug, sharedDir);
  // Migração: remove bloco legado do AGENTS.md (se o link v1 o escreveu),
  // deletando o arquivo só se ficar em branco.
  cleanLegacyAgentsBlock(repoAbs);
}

function writePointerFile(repoAbs: string, slug: string, sharedDir: string): void {
  const pointerPath = join(repoAbs, MEMORY_POINTER_FILE);
  const section = buildAgentsSection(slug, sharedDir);

  if (existsSync(pointerPath)) {
    const content = readFileSync(pointerPath, 'utf-8');
    if (content.includes(AGENTS_MARKER_START)) {
      const newContent = content.replace(
        new RegExp(`${AGENTS_MARKER_START}[\\s\\S]*?${AGENTS_MARKER_END}`),
        section.trim()
      );
      writeFileSync(pointerPath, newContent);
    } else {
      writeFileSync(pointerPath, content + '\n\n' + section);
    }
  } else {
    writeFileSync(pointerPath, section);
  }
}

// cleanLegacyAgentsBlock remove o bloco que o link v1 escrevia no AGENTS.md.
// Deleta o AGENTS.md só se ele ficar em branco (i.e. o tamem o havia criado).
export function cleanLegacyAgentsBlock(repoAbs: string): void {
  const agentsPath = join(repoAbs, 'AGENTS.md');
  if (!existsSync(agentsPath)) return;

  const content = readFileSync(agentsPath, 'utf-8');
  if (!content.includes(AGENTS_MARKER_START)) return;

  const newContent = content.replace(
    new RegExp(`${AGENTS_MARKER_START}[\\s\\S]*?${AGENTS_MARKER_END}\\n?`),
    ''
  );
  if (newContent.trim() === '') {
    rmSync(agentsPath, { force: true });
  } else {
    writeFileSync(agentsPath, newContent);
  }
}

export function removeAgentsSection(slug: string): void {
  const repo = getRepoFromConfig(slug);
  if (!repo) return;
  removeAgentsSectionAt(repo);
}

export function removeAgentsSectionAt(repoAbs: string): void {
  // Remove o pointer; deleta o arquivo se ficar vazio.
  const pointerPath = join(repoAbs, MEMORY_POINTER_FILE);
  if (existsSync(pointerPath)) {
    const content = readFileSync(pointerPath, 'utf-8');
    if (content.includes(AGENTS_MARKER_START)) {
      const newContent = content.replace(
        new RegExp(`${AGENTS_MARKER_START}[\\s\\S]*?${AGENTS_MARKER_END}\\n?`),
        ''
      );
      if (newContent.trim() === '') {
        rmSync(pointerPath, { force: true });
      } else {
        writeFileSync(pointerPath, newContent);
      }
    }
  }
  // Limpeza legada do AGENTS.md.
  cleanLegacyAgentsBlock(repoAbs);
}

export function checkAgentsSection(slug: string): boolean {
  const repo = getRepoFromConfig(slug);
  if (!repo) return false;
  return hasAgentsSectionAt(repo);
}

// hasAgentsSectionAt vale pro pointer novo e pro bloco legado no AGENTS.md,
// pra status/health funcionarem durante a transição.
export function hasAgentsSectionAt(repoAbs: string): boolean {
  try {
    const pointer = readFileSync(join(repoAbs, MEMORY_POINTER_FILE), 'utf-8');
    if (pointer.includes(AGENTS_MARKER_START)) return true;
  } catch { /* sem pointer */ }
  try {
    const agents = readFileSync(join(repoAbs, 'AGENTS.md'), 'utf-8');
    return agents.includes(AGENTS_MARKER_START);
  } catch {
    return false;
  }
}

// gitDirFor resolve o gitdir absoluto de um checkout (main ou worktree
// linkado). Null quando fora de repo git.
export function gitDirFor(repoAbs: string): string | null {
  try {
    const out = execSync('git rev-parse --absolute-git-dir', {
      cwd: repoAbs,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (!out) return null;
    return isAbsolute(out) ? out : resolve(repoAbs, out);
  } catch {
    return null;
  }
}

// ensureExcluded garante uma linha no $GIT_DIR/info/exclude (ignore local,
// nunca committado). Append idempotente, cria info/ se falta. No-op fora
// de repo git.
export function ensureExcluded(repoAbs: string, line: string): void {
  const gitdir = gitDirFor(repoAbs);
  if (!gitdir) return;
  const p = join(gitdir, 'info', 'exclude');
  try {
    if (existsSync(p)) {
      const content = readFileSync(p, 'utf-8');
      if (content.split('\n').some((l) => l.trim() === line)) return;
      const sep = content.length > 0 && !content.endsWith('\n') ? '\n' : '';
      writeFileSync(p, content + sep + line + '\n');
    } else {
      mkdirSync(join(gitdir, 'info'), { recursive: true });
      writeFileSync(p, line + '\n');
    }
  } catch (err) {
    console.error(`Erro atualizando exclude: ${err}`);
  }
}

// removeGitignoreLine apaga só a linha exata do .gitignore (migração da
// era em que o link escrevia lá). Preserva resto. Se sobrar vazio, apaga
// o arquivo (restaura estado pré-link quando fomos nós que o criamos).
export function removeGitignoreLine(repoAbs: string, line: string): void {
  const p = join(repoAbs, '.gitignore');
  try {
    if (!existsSync(p)) return;
    const content = readFileSync(p, 'utf-8');
    const kept = content.split('\n').filter((l) => l.trim() !== line);
    if (kept.length === content.split('\n').length) return;
    if (kept.join('\n').trim() === '') {
      rmSync(p, { force: true });
    } else {
      writeFileSync(p, kept.join('\n') + (kept.join('\n').endsWith('\n') ? '' : '\n'));
    }
  } catch (err) {
    console.error(`Erro limpando .gitignore: ${err}`);
  }
}

// Legado: link não usa mais (troca por .git/info/exclude local). Mantido
// por compat de import; prefira ensureExcluded + removeGitignoreLine.
export function ensureGitignored(repoAbs: string, line: string): void {
  const p = join(repoAbs, '.gitignore');
  try {
    if (existsSync(p)) {
      const content = readFileSync(p, 'utf-8');
      if (content.split('\n').some((l) => l.trim() === line)) return;
      const sep = content.length > 0 && !content.endsWith('\n') ? '\n' : '';
      writeFileSync(p, content + sep + line + '\n');
    } else {
      writeFileSync(p, line + '\n');
    }
  } catch (err) {
    console.error(`Erro atualizando .gitignore: ${err}`);
  }
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
    const configPath = join(process.env.HOME || homedir(), '.config', 'tabelhamem', 'config.toml');
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
// compartilhado (sem sobrescrever), cria o symlink e escreve o pointer
// .tabelhamem.md. Opera em todos os worktrees do repo. Idempotente.
// Não toca nenhum arquivo tracked: o pointer é ignorado via
// $GIT_DIR/info/exclude (local, nunca committado) e qualquer linha legada
// no .gitignore é removida.
export function linkRepo(repoAbs: string, slug: string): void {
  const shared = ensureSharedDir(slug);
  // O pointer é local (path absoluto da máquina); nunca commitar.
  // Ignore local por worktree (cada worktree tem seu próprio gitdir).
  // Migração: limpa linha legada que o link v1 escrevia no .gitignore.
  removeGitignoreLine(repoAbs, MEMORY_POINTER_FILE);
  for (const wt of gitWorktrees(repoAbs)) {
    ensureExcluded(wt, MEMORY_POINTER_FILE);
    // Todo config dir aponta pro mesmo ~/agent-memory/<slug>: sem roteamento
    // por conta, ligar em todos é inofensivo.
    for (const md of claudeMemoryDirs(wt)) migrateAndLink(md, shared);
    ensureAgentsSectionAt(wt, slug, shared);
  }
}

// unlinkRepo desfaz o link de um repo explícito: o diretório de memória do
// Claude Code (em cada config dir ligado) volta a ter uma cópia real do
// conteúdo compartilhado (o compartilhado não é tocado) e o pointer é removido.
export function unlinkRepo(repoAbs: string, slug: string): void {
  const shared = getSharedDir(slug);
  for (const wt of gitWorktrees(repoAbs)) {
    for (const cmd of claudeMemoryDirs(wt)) {
      // Só mexe onde havia symlink pro compartilhado: não cria dir de
      // memória em config dir que nunca foi ligado.
      if (!symlinkPointsTo(cmd, shared)) continue;
      rmSync(cmd);
      mkdirSync(cmd, { recursive: true });
      if (existsSync(shared)) copyMerge(shared, cmd);
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

// migrateAndLink junta o dir de memória real no compartilhado e troca por
// symlink. Com conflito (mesmo nome, conteúdo diferente) não toca em nada:
// o dir real fica e o symlink não é criado, pra nunca perder arquivo.
function migrateAndLink(claudeDir: string, shared: string): void {
  mkdirSync(join(claudeDir, '..'), { recursive: true });
  let st;
  try {
    st = lstatSync(claudeDir);
  } catch { /* não existia, segue */ }
  if (st?.isSymbolicLink()) {
    if (symlinkPointsTo(claudeDir, shared)) return;
    rmSync(claudeDir);
  } else if (st?.isDirectory()) {
    const plan = planMerge([claudeDir], shared);
    if (plan.conflicts.length > 0) {
      console.error(`Conflito migrando ${claudeDir}; dir real mantido, symlink não criado:`);
      for (const c of plan.conflicts) console.error(`  ${c.rel}: ${c.sources.join(' <> ')}`);
      return;
    }
    applyMerge(plan, shared);
    rmSync(claudeDir, { recursive: true, force: true });
  } else if (st) {
    console.error(`${claudeDir} existe e não é dir nem symlink; ignorado`);
    return;
  }
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
