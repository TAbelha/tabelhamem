import type { IPCArgs } from './types.js';
import { ipcGlobal } from './global.js';
import { ipcLink } from './link.js';
import { ipcUnlink } from './unlink.js';
import { ipcStatus } from './status.js';
import { ipcList } from './list.js';
import { ipcSearch } from './search.js';
import { ipcHealth } from './health.js';
import { ipcSearchDigest } from './search-digest.js';

export function runIPC(args: IPCArgs): number {
  switch (args.method) {
    case 'global':
      return ipcGlobal(args);
    case 'link':
      return ipcLink(args);
    case 'unlink':
      return ipcUnlink(args);
    case 'status':
      return ipcStatus(args);
    case 'list':
      return ipcList(args);
    case 'search':
      return ipcSearch(args);
    case 'health':
      return ipcHealth(args);
    case 'search-digest':
      return ipcSearchDigest(args);
    default:
      console.error(`método desconhecido: ${args.method}`);
      return 1;
  }
}
