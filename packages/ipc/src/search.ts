import type { IPCArgs, SearchMatch } from './types.js';
import { getSharedDir } from './store.js';
import { readdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export function ipcSearch(args: IPCArgs): number {
  const { query, type, project } = args.filters;

  if (!query) {
    console.error('query= é obrigatório');
    return 1;
  }

  const results = searchMemory(query, type || '', project || '');

  console.log(JSON.stringify(results, null, 2));
  return 0;
}

export function searchMemory(query: string, type: string, project: string): SearchMatch[] {
  const projects = project ? [project] : listProjects();
  const results: SearchMatch[] = [];

  for (const slug of projects) {
    const sharedDir = getSharedDir(slug);
    if (!existsSync(sharedDir)) continue;

    const files = readdirSync(sharedDir).filter(f => f.endsWith('.md'));

    for (const file of files) {
      if (type && !file.includes(type)) continue;

      const content = readFileSync(join(sharedDir, file), 'utf-8');
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        if (lines[i].toLowerCase().includes(query.toLowerCase())) {
          const snippet = lines.slice(Math.max(0, i - 1), i + 2).join('\n');
          results.push({
            project: slug,
            file,
            name: file.replace('.md', ''),
            snippet,
          });
        }
      }
    }
  }

  return results;
}

function listProjects(): string[] {
  const agentMemoryDir = join(homedir(), 'agent-memory');
  if (!existsSync(agentMemoryDir)) return [];

  return readdirSync(agentMemoryDir, { withFileTypes: true })
    .filter(e => e.isDirectory())
    .map(e => e.name);
}
