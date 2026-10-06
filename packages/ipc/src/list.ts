import type { IPCArgs, ProjectInfo } from './types.js';
import { discoverProjects } from './discover.js';

export function ipcList(_args: IPCArgs): number {
  console.log(JSON.stringify(listProjects(), null, 2));
  return 0;
}

// listProjects agora usa a descoberta (repos + memória), com status real
// da ponte em vez do caminho morto da config.
export function listProjects(): ProjectInfo[] {
  return discoverProjects().map((d) => ({
    slug: d.slug,
    repo: d.repo,
    sharedDir: d.sharedDir,
    topicCount: d.topicCount,
    claudeLinked: d.linked,
    opencodeLinked: d.agentsSection,
    agentsSection: d.agentsSection,
    worktreeCount: 0,
  }));
}
