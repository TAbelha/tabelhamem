import type { HookConfig, SessionEvent } from './types.js';
import { ipcLink } from '@tabelhamem/ipc';

export function createHooks(config: HookConfig) {
  return {
    'session.idle': async (event: SessionEvent) => {
      const sessionID = event.properties?.sessionID as string;
      if (sessionID) {
        await writeSessionSummary(config.project, sessionID);
      }
    },

    'session.deleted': async (event: SessionEvent) => {
      const sessionID = event.properties?.sessionID as string;
      if (sessionID) {
        await writeSessionSummary(config.project, sessionID);
      }
    },

    'session.compacted': async (event: SessionEvent) => {
      const sessionID = event.properties?.sessionID as string;
      if (sessionID) {
        await writeCompactionSummary(config.project, sessionID);
      }
    },
  };
}

async function writeSessionSummary(project: string, sessionID: string): Promise<void> {
  // TODO: Implement session summary writing
}

async function writeCompactionSummary(project: string, sessionID: string): Promise<void> {
  // TODO: Implement compaction summary writing
}
