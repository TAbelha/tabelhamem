export type IPCMethod = 'global' | 'link' | 'unlink' | 'status' | 'list' | 'search' | 'health' | 'search-digest';
export interface IPCArgs {
    method: IPCMethod;
    filters: Record<string, string>;
    json: boolean;
}
export interface ProjectInfo {
    slug: string;
    repo: string;
    sharedDir: string;
    topicCount: number;
    claudeLinked: boolean;
    opencodeLinked: boolean;
    agentsSection: boolean;
    worktreeCount: number;
}
export interface SearchMatch {
    project: string;
    file: string;
    name: string;
    snippet: string;
}
export interface HealthStatus {
    slug: string;
    claudeLinked: boolean;
    opencodeLinked: boolean;
    agentsSection: boolean;
    sharedDir: string;
    topicCount: number;
    worktreeCount: number;
}
