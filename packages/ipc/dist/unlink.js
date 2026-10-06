import { removeClaudeSymlink, removeAgentsSection } from './store.js';
export function ipcUnlink(args) {
    const { project, repo } = args.filters;
    if (!project) {
        console.error('project= é obrigatório');
        return 1;
    }
    if (!repo) {
        console.error('repo= é obrigatório');
        return 1;
    }
    removeClaudeSymlink(project);
    removeAgentsSection(project);
    console.log(JSON.stringify({
        status: 'ok',
        project,
        repo,
        message: `Projeto ${project} desligado`,
    }));
    return 0;
}
