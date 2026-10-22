import type { IPCArgs, HealthStatus } from './types.js';
import { checkClaudeSymlink, checkAgentsSection, getSharedDir, getTopicCount, hasAgentsSectionAt } from './store.js';
import { linkedConfigDirs } from './discover.js';

export function ipcStatus(args: IPCArgs): number {
  const { project, repo } = args.filters;

  if (!project) {
    console.error('project= é obrigatório');
    return 1;
  }

  const sharedDir = getSharedDir(project);
  // Com repo explícito, checa direto nele. Sem repo, cai no caminho legado
  // via config (que responde false sem ~/.config/tabelhamem/config.toml).
  const claudeLinkedDirs = repo ? linkedConfigDirs(repo, sharedDir) : undefined;
  const claudeLinked = claudeLinkedDirs
    ? claudeLinkedDirs.length > 0
    : checkClaudeSymlink(project);
  const agentsSection = repo
    ? hasAgentsSectionAt(repo)
    : checkAgentsSection(project);
  const topicCount = getTopicCount(project);

  const status: HealthStatus = {
    slug: project,
    claudeLinked,
    opencodeLinked: agentsSection,
    agentsSection,
    sharedDir,
    topicCount,
    worktreeCount: 0,
  };
  // Com repo explícito, mostra em quais config dirs do Claude há symlink.
  if (claudeLinkedDirs) status.claudeLinkedDirs = claudeLinkedDirs;

  console.log(JSON.stringify(status, null, 2));
  return 0;
}
