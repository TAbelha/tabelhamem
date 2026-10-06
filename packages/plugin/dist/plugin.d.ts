import type { PluginConfig, SessionEvent, ToolInput } from './types.js';
export declare function createPlugin(config: PluginConfig): {
    'chat.message': (input: {
        sessionID: string;
    }) => Promise<void>;
    'tool.execute.after': (input: {
        sessionID: string;
        tool: string;
        args: unknown;
        output: unknown;
    }) => Promise<void>;
    event: ({ event }: {
        event: SessionEvent;
    }) => Promise<void>;
    tool: {
        memory_search: {
            description: string;
            parameters: {
                type: string;
                properties: {
                    query: {
                        type: string;
                        description: string;
                    };
                    type: {
                        type: string;
                        description: string;
                    };
                };
                required: string[];
            };
            execute: (args: ToolInput) => Promise<number>;
        };
        memory_write: {
            description: string;
            parameters: {
                type: string;
                properties: {
                    content: {
                        type: string;
                        description: string;
                    };
                    type: {
                        type: string;
                        description: string;
                    };
                };
                required: string[];
            };
            execute: (args: ToolInput) => Promise<{
                status: string;
            }>;
        };
    };
};
