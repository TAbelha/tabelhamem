import { ipcList } from '@tabelhamem/ipc';
export async function runTUI() {
    // TODO: Implement OpenTUI + Solid TUI
    // For now, just list projects
    const projects = await ipcList({ method: 'list', filters: {}, json: true });
    console.log('Projetos:', projects);
}
