import type { IPCArgs } from './types.js';
import { ensureSharedDir, ensureClaudeSymlink, ensureAgentsSection, linkRepo, getSharedDir } from './store.js';

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

  // Com repo explícito, opera direto nele (todos os worktrees). Sem repo,
  // cai no caminho legado via ~/.config/tabelhamem/config.toml.
  if (repo) {
    linkRepo(repo, project);
  } else {
    const legacyDir = ensureSharedDir(project);
    ensureClaudeSymlink(project, legacyDir);
    ensureAgentsSection(project, legacyDir);
  }

  const sharedDir = getSharedDir(project);

  console.log(JSON.stringify({
    status: 'ok',
    project,
    repo,
    sharedDir,
    message: `Projeto ${project} ligado`,
  }));

  return 0;
}
