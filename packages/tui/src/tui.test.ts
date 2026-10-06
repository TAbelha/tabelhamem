import { describe, it, expect } from 'vitest';
import { listProjects } from '@tabelhamem/ipc';

describe('tui', () => {
  it('listProjects retorna projetos com repo e status da ponte', () => {
    const result = listProjects();

    expect(Array.isArray(result)).toBe(true);
    for (const p of result) {
      expect(typeof p.slug).toBe('string');
      expect(typeof p.sharedDir).toBe('string');
      expect(typeof p.claudeLinked).toBe('boolean');
    }
  });
});
