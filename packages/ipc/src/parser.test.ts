import { describe, it, expect } from 'vitest';
import { parseIPCArgs } from './parser.js';

describe('parseIPCArgs', () => {
  it('parseia método e filtros', () => {
    const result = parseIPCArgs(['link', 'project=tabelharadar', 'repo=/home/x/repo', '--json']);

    expect(result.method).toBe('link');
    expect(result.filters.project).toBe('tabelharadar');
    expect(result.filters.repo).toBe('/home/x/repo');
    expect(result.json).toBe(true);
  });

  it('rejeita método desconhecido', () => {
    expect(() => parseIPCArgs(['nao-existe'])).toThrow('método desconhecido');
  });

  it('rejeita args vazios', () => {
    expect(() => parseIPCArgs([])).toThrow('método não especificado');
  });

  it('preserva = dentro do valor', () => {
    const result = parseIPCArgs(['search', 'query=a=b']);

    expect(result.filters.query).toBe('a=b');
  });

  it('parseia migrate com --dry-run como flag', () => {
    const result = parseIPCArgs(['migrate', 'project=ws', 'path=/home/x', '--dry-run', '--json']);

    expect(result.method).toBe('migrate');
    expect(result.filters).toEqual({ project: 'ws', path: '/home/x', 'dry-run': 'true' });
    expect(result.json).toBe(true);
  });
});
