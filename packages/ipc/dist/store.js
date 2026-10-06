import { execSync } from 'child_process';
import { existsSync, symlinkSync, mkdirSync, readFileSync, writeFileSync, rmSync, readdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
const AGENTS_MARKER_START = '<!-- tabelhamem:start -->';
const AGENTS_MARKER_END = '<!-- tabelhamem:end -->';
export function getSharedDir(slug) {
    return join(homedir(), 'agent-memory', slug);
}
export function ensureSharedDir(slug) {
    const dir = getSharedDir(slug);
    mkdirSync(dir, { recursive: true });
    return dir;
}
export function getTopicCount(slug) {
    const dir = getSharedDir(slug);
    if (!existsSync(dir))
        return 0;
    return readdirSync(dir).filter(f => f.endsWith('.md')).length;
}
export function claudeMemoryDir(repoAbs) {
    const encoded = repoAbs.replace(/\//g, '-').replace(/\./g, '-');
    return join(homedir(), '.claude', 'projects', encoded, 'memory');
}
export function ensureClaudeSymlink(slug, sharedDir) {
    const repo = getRepoFromConfig(slug);
    if (!repo)
        return;
    const claudeDir = claudeMemoryDir(repo);
    const claudeParent = join(claudeDir, '..');
    mkdirSync(claudeParent, { recursive: true });
    if (existsSync(claudeDir)) {
        const stats = readFileSync(claudeDir, 'utf-8');
        if (stats.includes(sharedDir))
            return;
    }
    try {
        rmSync(claudeDir, { recursive: true, force: true });
        symlinkSync(sharedDir, claudeDir);
    }
    catch (err) {
        console.error(`Erro criando symlink: ${err}`);
    }
}
export function removeClaudeSymlink(slug) {
    const repo = getRepoFromConfig(slug);
    if (!repo)
        return;
    const claudeDir = claudeMemoryDir(repo);
    if (existsSync(claudeDir)) {
        rmSync(claudeDir, { recursive: true, force: true });
    }
}
export function checkClaudeSymlink(slug) {
    const repo = getRepoFromConfig(slug);
    if (!repo)
        return false;
    const claudeDir = claudeMemoryDir(repo);
    if (!existsSync(claudeDir))
        return false;
    try {
        const target = readFileSync(claudeDir, 'utf-8');
        return target.includes(getSharedDir(slug));
    }
    catch {
        return false;
    }
}
export function ensureAgentsSection(slug, sharedDir) {
    const repo = getRepoFromConfig(slug);
    if (!repo)
        return;
    const agentsPath = join(repo, 'AGENTS.md');
    const section = buildAgentsSection(slug, sharedDir);
    if (existsSync(agentsPath)) {
        const content = readFileSync(agentsPath, 'utf-8');
        if (content.includes(AGENTS_MARKER_START)) {
            const newContent = content.replace(new RegExp(`${AGENTS_MARKER_START}[\\s\\S]*?${AGENTS_MARKER_END}`), section.trim());
            writeFileSync(agentsPath, newContent);
        }
        else {
            writeFileSync(agentsPath, content + '\n\n' + section);
        }
    }
    else {
        writeFileSync(agentsPath, section);
    }
}
export function removeAgentsSection(slug) {
    const repo = getRepoFromConfig(slug);
    if (!repo)
        return;
    const agentsPath = join(repo, 'AGENTS.md');
    if (!existsSync(agentsPath))
        return;
    const content = readFileSync(agentsPath, 'utf-8');
    if (content.includes(AGENTS_MARKER_START)) {
        const newContent = content.replace(new RegExp(`${AGENTS_MARKER_START}[\\s\\S]*?${AGENTS_MARKER_END}\\n?`), '');
        writeFileSync(agentsPath, newContent);
    }
}
export function checkAgentsSection(slug) {
    const repo = getRepoFromConfig(slug);
    if (!repo)
        return false;
    const agentsPath = join(repo, 'AGENTS.md');
    if (!existsSync(agentsPath))
        return false;
    const content = readFileSync(agentsPath, 'utf-8');
    return content.includes(AGENTS_MARKER_START);
}
function buildAgentsSection(slug, sharedDir) {
    return `${AGENTS_MARKER_START}
## Memória Compartilhada

Este projeto usa memória compartilhada em \`${sharedDir}\`.

Instruções:
- Leia \`${sharedDir}/\` no início da sessão
- Escreva resumos da sessão no final
- Use \`tamem ipc search\` para buscar memória
${AGENTS_MARKER_END}`;
}
function getRepoFromConfig(slug) {
    try {
        const configPath = join(homedir(), '.config', 'tabelhamem', 'config.toml');
        if (!existsSync(configPath))
            return null;
        const content = readFileSync(configPath, 'utf-8');
        const lines = content.split('\n');
        let inProject = false;
        for (const line of lines) {
            if (line.startsWith('[[')) {
                inProject = line.includes(`slug = "${slug}"`);
            }
            else if (inProject && line.startsWith('repo =')) {
                return line.split('=')[1].trim().replace(/"/g, '');
            }
        }
    }
    catch {
        return null;
    }
    return null;
}
export function gitWorktrees(repo) {
    try {
        const out = execSync('git worktree list --porcelain', { cwd: repo, encoding: 'utf-8' });
        const paths = [];
        for (const line of out.split('\n')) {
            if (line.startsWith('worktree ')) {
                paths.push(line.replace('worktree ', ''));
            }
        }
        return paths.length > 0 ? paths : [repo];
    }
    catch {
        return [repo];
    }
}
