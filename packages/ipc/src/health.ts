import type { IPCArgs } from './types.js';
import { discoverProjects } from './discover.js';

export function ipcHealth(_args: IPCArgs): number {
  const projects = discoverProjects();

  if (projects.length === 0) {
    console.log('# Saúde da Ponte tabelhamem\n\nNenhum projeto configurado.');
    return 0;
  }

  let md = '# Saúde da Ponte tabelhamem\n\n';
  md += '| Projeto | Repo | Claude | OpenCode | Tópicos |\n';
  md += '|---------|------|--------|----------|----------|\n';

  for (const p of projects) {
    const claude = p.linked ? '✅' : '❌';
    const opencode = p.agentsSection ? '✅' : '❌';
    const where = p.memoryOnly ? '(memória)' : `${p.org}/${p.slug}`;
    md += `| ${p.slug} | ${where} | ${claude} | ${opencode} | ${p.topicCount} |\n`;
  }

  console.log(md);
  return 0;
}
