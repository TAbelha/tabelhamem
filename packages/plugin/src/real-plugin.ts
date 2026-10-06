import type { PluginConfig, SessionEvent, ToolInput } from './types.js';
import { ipcSearch, ipcLink, ipcStatus } from '@tabelhamem/ipc';
import { writeFileSync, mkdirSync, readFileSync, existsSync, appendFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export function createRealPlugin(config: PluginConfig) {
  return {
    'chat.message': async (input: { sessionID: string }) => {
      await ipcLink({ method: 'link', filters: { project: config.project, repo: config.repo }, json: true });
    },

    'tool.execute.after': async (input: { sessionID: string; tool: string; args: unknown; output: unknown }) => {
      const observation = {
        sessionID: input.sessionID,
        tool: input.tool,
        args: input.args,
        output: input.output,
        timestamp: new Date().toISOString(),
      };

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

interface Observation {
  sessionID: string;
  tool: string;
  args: unknown;
  output: unknown;
  timestamp: string;
}

async function writeObservation(project: string, observation: Observation): Promise<void> {
  const sharedDir = join(homedir(), 'agent-memory', project);
  if (!existsSync(sharedDir)) {
    mkdirSync(sharedDir, { recursive: true });
  }

  const date = new Date().toISOString().split('T')[0];
  const filename = `observations_${date}.md`;
  const filepath = join(sharedDir, filename);

  const entry = `---\ntype: observation\ntool: ${observation.tool}\ntimestamp: ${observation.timestamp}\n---\n\n\`\`\`json\n${JSON.stringify(observation, null, 2)}\n\`\`\`\n\n`;

  appendFileSync(filepath, entry);
}

async function writeSessionSummary(project: string, sessionID: string): Promise<void> {
  const sharedDir = join(homedir(), 'agent-memory', project);
  if (!existsSync(sharedDir)) {
    mkdirSync(sharedDir, { recursive: true });
  }

  const date = new Date().toISOString().split('T')[0];
  const filename = `session_${date}.md`;
  const filepath = join(sharedDir, filename);

  const summary = `---\ntype: session_summary\nsessionID: ${sessionID}\ndate: ${date}\n---\n\n## Sessão ${sessionID}\n\nResumo da sessão será gerado pelo modelo.\n\n`;

  appendFileSync(filepath, summary);
}

async function writeCompactionSummary(project: string, sessionID: string): Promise<void> {
  const sharedDir = join(homedir(), 'agent-memory', project);
  if (!existsSync(sharedDir)) {
    mkdirSync(sharedDir, { recursive: true });
  }

  const date = new Date().toISOString().split('T')[0];
  const filename = `compaction_${date}.md`;
  const filepath = join(sharedDir, filename);

  const summary = `---\ntype: compaction_summary\nsessionID: ${sessionID}\ndate: ${date}\n---\n\n## Compactação ${sessionID}\n\nResumo da compactação será gerado pelo modelo.\n\n`;

  appendFileSync(filepath, summary);
}

async function writeMemory(project: string, content: string, type: string): Promise<void> {
  const sharedDir = join(homedir(), 'agent-memory', project);
  if (!existsSync(sharedDir)) {
    mkdirSync(sharedDir, { recursive: true });
  }

  const date = new Date().toISOString().split('T')[0];
  const filename = `${type}_${date}.md`;
  const filepath = join(sharedDir, filename);

  const entry = `---\ntype: ${type}\ndate: ${date}\n---\n\n${content}\n\n`;

  appendFileSync(filepath, entry);
}
