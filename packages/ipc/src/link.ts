import type { IPCArgs } from './types.js';
import { ensureSharedDir, ensureClaudeSymlink, ensureAgentsSection } from './store.js';

export function ipcLink(args: IPCArgs): number {
  const { project, repo } = args.filters;

  if (!project) {
    console.error('project= é obrigatório');
    return 1;
  }
  if (!repo) {
    console.error('repo= é obrigatório');
    return 1;
  }

  const sharedDir = ensureSharedDir(project);
  ensureClaudeSymlink(project, sharedDir);
  ensureAgentsSection(project, sharedDir);

  console.log(JSON.stringify({
    status: 'ok',
    project,
    repo,
    sharedDir,
    message: `Projeto ${project} ligado`,
  }));

  return 0;
}
