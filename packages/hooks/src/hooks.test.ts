import { describe, it, expect } from 'vitest';
import { createHooks } from './hooks.js';

describe('hooks', () => {
  it('cria hooks para os três eventos de sessão', () => {
    const hooks = createHooks({ project: 'test', repo: '/tmp/repo', sharedDir: '/tmp/shared' });

    expect(typeof hooks['session.idle']).toBe('function');
    expect(typeof hooks['session.deleted']).toBe('function');
    expect(typeof hooks['session.compacted']).toBe('function');
  });

  it('session.idle não lança com sessionID ausente', async () => {
    const hooks = createHooks({ project: 'test', repo: '/tmp/repo', sharedDir: '/tmp/shared' });

    await expect(hooks['session.idle']({ type: 'session.idle', properties: {} })).resolves.toBeUndefined();
  });
});
