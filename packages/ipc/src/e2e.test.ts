import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import { existsSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { tmpdir } from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI = join(__dirname, 'cli.ts');
const HOME = process.env.HOME || '';

describe('E2E: ponte de memória compartilhada', () => {
  let testDir: string;
  let sharedDir: string;
  let claudeDir: string;
  let repoDir: string;
  let realHome: string | undefined;

  beforeEach(() => {
    testDir = join(tmpdir(), `tabelhamem-e2e-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    sharedDir = join(testDir, 'agent-memory', 'test-project');
    claudeDir = join(testDir, '.claude', 'projects', 'test-project', 'memory');
    repoDir = join(testDir, 'repo');

    mkdirSync(sharedDir, { recursive: true });
    mkdirSync(claudeDir, { recursive: true });
    mkdirSync(repoDir, { recursive: true });

    realHome = process.env.HOME;
    process.env.HOME = testDir;
  });

  afterEach(() => {
    process.env.HOME = realHome;
    rmSync(testDir, { recursive: true, force: true });
  });

  const run = (args: string): string =>
    execSync(`bun run ${CLI} ipc ${args}`, { encoding: 'utf-8', env: { ...process.env, HOME: testDir } });

  it('deve criar symlink do Claude Code para memória compartilhada', () => {
    const result = run(`link project=test-project repo=${repoDir} --json`);

    expect(result).toContain('"status":"ok"');
    expect(existsSync(join(testDir, 'agent-memory', 'test-project'))).toBe(true);
  });

  it('deve escrever memória e ler pelo outro lado', () => {
    const content = '# Feedback\n\nUsuário prefere TypeScript puro\n';
    writeFileSync(join(sharedDir, 'feedback_test.md'), content);

    const result = run('search query=TypeScript --json');

    expect(result).toContain('TypeScript');
    expect(result).toContain('feedback_test.md');
  });

  it('deve desfazer link sem tocar no diretório compartilhado', () => {
    run(`link project=test-project repo=${repoDir} --json`);
    run(`unlink project=test-project repo=${repoDir} --json`);

    expect(existsSync(sharedDir)).toBe(true);
  });

  it('deve listar projetos corretamente', () => {
    writeFileSync(join(sharedDir, 'test.md'), '# Test');

    const result = run('list --json');

    expect(result).toContain('test-project');
  });

  it('deve reportar saúde da ponte', () => {
    writeFileSync(join(sharedDir, 'test.md'), '# Test');

    const result = run('health');

    expect(result).toContain('test-project');
    expect(result).toContain('Claude');
    expect(result).toContain('OpenCode');
  });
});
