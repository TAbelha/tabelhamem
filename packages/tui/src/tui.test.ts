import { describe, it, expect } from 'vitest';
import { listProjects } from '@tabelhamem/ipc';

describe('tui', () => {
  it('listProjects retorna array (vazio em ambiente limpo)', () => {
    const result = listProjects();

    expect(Array.isArray(result)).toBe(true);
  });
});
