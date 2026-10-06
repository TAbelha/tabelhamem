import { ipcList, ipcSearch, ipcStatus } from '@tabelhamem/ipc';
import type { ProjectInfo, SearchMatch } from '@tabelhamem/ipc';

export async function runTUI(): Promise<void> {
  // TODO: Implement OpenTUI + Solid TUI
  // For now, just list projects
  const projects = await ipcList({ method: 'list', filters: {}, json: true });
  console.log('Projetos:', projects);
}
