import { readdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { getSharedDir } from './store.js';

export function listTopicFiles(slug: string): string[] {
  const dir = getSharedDir(slug);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith('.md')).sort();
}

export function readTopicFile(slug: string, file: string): string {
  const full = join(getSharedDir(slug), file);
  if (!existsSync(full)) return '';
  return readFileSync(full, 'utf-8');
}
