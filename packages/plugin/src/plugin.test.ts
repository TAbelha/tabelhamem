import { describe, it, expect } from 'vitest';
import { createPlugin } from './plugin.js';

describe('plugin OpenCode', () => {
  const config = { project: 'test', repo: '/tmp/repo', sharedDir: '/tmp/shared' };

  it('expõe os três hooks de sessão', () => {
    const plugin = createPlugin(config);

    expect(typeof plugin['chat.message']).toBe('function');
    expect(typeof plugin['tool.execute.after']).toBe('function');
    expect(typeof plugin.event).toBe('function');
  });

  it('expõe as duas tools de memória', () => {
    const plugin = createPlugin(config);

    expect(plugin.tool.memory_search).toBeDefined();
    expect(plugin.tool.memory_write).toBeDefined();
    expect(plugin.tool.memory_search.parameters.required).toContain('query');
    expect(plugin.tool.memory_write.parameters.required).toContain('content');
  });

  it('session.idle sem sessionID não lança', async () => {
    const plugin = createPlugin(config);

    await expect(
      plugin.event({ event: { type: 'session.idle', properties: {} } })
    ).resolves.toBeUndefined();
  });
});
