import { ensureSharedDir, ensureClaudeSymlink, ensureAgentsSection } from './store.js';
export function ipcGlobal(_args) {
    const sharedDir = ensureSharedDir('global');
    ensureClaudeSymlink('global', sharedDir);
    ensureAgentsSection('global', sharedDir);
    console.log(JSON.stringify({
        status: 'ok',
        sharedDir,
        message: 'Armazenamento global configurado',
    }));
    return 0;
}
