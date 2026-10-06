import type { PluginConfig, SessionEvent, ToolInput } from './types.js';
import { ipcSearch, ipcLink, ipcStatus } from '@tabelhamem/ipc';

export function createPlugin(config: PluginConfig) {
  return {
    'chat.message': async (input: { sessionID: string }) => {
      // Initialize session tracking
      await ipcLink({ method: 'link', filters: { project: config.project, repo: config.repo }, json: true });
    },

    'tool.execute.after': async (input: { sessionID: string; tool: string; args: unknown; output: unknown }) => {
      // Capture tool execution as observation
      const observation = {
        sessionID: input.sessionID,
        tool: input.tool,
        args: input.args,
        output: input.output,
        timestamp: new Date().toISOString(),
      };

      // Write to shared memory
      await writeObservation(config.project, observation);
    },

    event: async ({ event }: { event: SessionEvent }) => {
      if (event.type === 'session.idle') {
        const sessionID = event.properties?.sessionID as string;
        if (sessionID) {
          await writeSessionSummary(config.project, sessionID);
        }
      }

      if (event.type === 'session.deleted') {
        const sessionID = event.properties?.sessionID as string;
        if (sessionID) {
          await writeSessionSummary(config.project, sessionID);
        }
      }

      if (event.type === 'session.compacted') {
        const sessionID = event.properties?.sessionID as string;
        if (sessionID) {
          await writeCompactionSummary(config.project, sessionID);
        }
      }
    },

    tool: {
      memory_search: {
        description: 'Busca texto na memória compartilhada do projeto',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Termo de busca' },
            type: { type: 'string', description: 'Filtro por tipo (feedback, project, reference, user)' },
          },
          required: ['query'],
        },
        execute: async (args: ToolInput) => {
          const result = await ipcSearch({
            method: 'search',
            filters: { query: args.query || '', type: args.type || '', project: config.project },
            json: true,
          });
          return result;
        },
      },

      memory_write: {
        description: 'Escreve na memória compartilhada do projeto',
        parameters: {
          type: 'object',
          properties: {
            content: { type: 'string', description: 'Conteúdo a escrever' },
            type: { type: 'string', description: 'Tipo da memória (feedback, project, reference, user)' },
          },
          required: ['content'],
        },
        execute: async (args: ToolInput) => {
          await writeMemory(config.project, args.content || '', args.type || 'feedback');
          return { status: 'ok' };
        },
      },
    },
  };
}

async function writeObservation(project: string, observation: unknown): Promise<void> {
  // TODO: Implement observation writing
}

async function writeSessionSummary(project: string, sessionID: string): Promise<void> {
  // TODO: Implement session summary writing
}

async function writeCompactionSummary(project: string, sessionID: string): Promise<void> {
  // TODO: Implement compaction summary writing
}

async function writeMemory(project: string, content: string, type: string): Promise<void> {
  // TODO: Implement memory writing
}
