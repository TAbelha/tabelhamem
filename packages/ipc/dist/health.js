import { getSharedDir, getTopicCount, checkClaudeSymlink, checkAgentsSection } from './store.js';
import { readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
export function ipcHealth(_args) {
    const agentMemoryDir = join(homedir(), 'agent-memory');
    if (!existsSync(agentMemoryDir)) {
        console.log('# Saúde da Ponte tabelhamem\n\nNenhum projeto configurado.');
        return 0;
    }
    const entries = readdirSync(agentMemoryDir, { withFileTypes: true });
    const projects = [];
    for (const entry of entries) {
        if (!entry.isDirectory())
            continue;
        const slug = entry.name;
        const sharedDir = getSharedDir(slug);
        projects.push({
            slug,
            claudeLinked: checkClaudeSymlink(slug),
            opencodeLinked: checkAgentsSection(slug),
            agentsSection: checkAgentsSection(slug),
            sharedDir,
            topicCount: getTopicCount(slug),
            worktreeCount: 0,
        });
    }
    let md = '# Saúde da Ponte tabelhamem\n\n';
    md += '| Projeto | Claude | OpenCode | Tópicos |\n';
    md += '|---------|--------|----------|----------|\n';
    for (const p of projects) {
        const claude = p.claudeLinked ? '✅' : '❌';
        const opencode = p.opencodeLinked ? '✅' : '❌';
        md += `| ${p.slug} | ${claude} | ${opencode} | ${p.topicCount} |\n`;
    }
    console.log(md);
    return 0;
}
