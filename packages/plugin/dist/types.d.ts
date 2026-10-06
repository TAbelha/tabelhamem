export interface PluginConfig {
    project: string;
    repo: string;
    sharedDir: string;
}
export interface SessionEvent {
    type: string;
    properties?: Record<string, unknown>;
}
export interface ToolInput {
    query?: string;
    type?: string;
    project?: string;
    content?: string;
}
