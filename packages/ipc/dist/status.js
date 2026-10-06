import { checkClaudeSymlink, checkAgentsSection, getSharedDir, getTopicCount } from './store.js';
export function ipcStatus(args) {
    const { project, repo } = args.filters;
    if (!project) {
        console.error('project= é obrigatório');
        return 1;
    }
    const sharedDir = getSharedDir(project);
    const claudeLinked = checkClaudeSymlink(project);
    const agentsSection = checkAgentsSection(project);
    const topicCount = getTopicCount(project);
    const status = {
        slug: project,
        claudeLinked,
        opencodeLinked: agentsSection,
        agentsSection,
        sharedDir,
        topicCount,
        worktreeCount: 0,
    };
    console.log(JSON.stringify(status, null, 2));
    return 0;
}
