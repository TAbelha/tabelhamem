export interface HookConfig {
    project: string;
    repo: string;
    sharedDir: string;
}
export interface SessionEvent {
    type: string;
    properties?: Record<string, unknown>;
}
