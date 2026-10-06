import type { HookConfig, SessionEvent } from './types.js';
export declare function createHooks(config: HookConfig): {
    'session.idle': (event: SessionEvent) => Promise<void>;
    'session.deleted': (event: SessionEvent) => Promise<void>;
    'session.compacted': (event: SessionEvent) => Promise<void>;
};
