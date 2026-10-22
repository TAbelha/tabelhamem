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
  let realCCD: string | undefined;

  beforeEach(() => {
    testDir = join(tmpdir(), `tabelhamem-e2e-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    sharedDir = join(testDir, 'agent-memory', 'test-project');
    claudeDir = join(testDir, '.claude', 'projects', 'test-project', 'memory');
    repoDir = join(testDir, 'repo');

    mkdirSync(sharedDir, { recursive: true });
    mkdirSync(claudeDir, { recursive: true });
    mkdirSync(repoDir, { recursive: true });

    realHome = process.env.HOME;
    realCCD = process.env.CLAUDE_CONFIG_DIR;
    delete process.env.CLAUDE_CONFIG_DIR;
    process.env.HOME = testDir;
  });

  afterEach(() => {
    process.env.HOME = realHome;
    if (realCCD === undefined) delete process.env.CLAUDE_CONFIG_DIR;
    else process.env.CLAUDE_CONFIG_DIR = realCCD;
    rmSync(testDir, { recursive: true, force: true });
  });

  // Env sem CLAUDE_CONFIG_DIR: senão o CLI escreveria no config dir real.
  const cliEnv = (): NodeJS.ProcessEnv => {
    const { CLAUDE_CONFIG_DIR: _drop, ...rest } = process.env;
    return { ...rest, HOME: testDir };
  };

  const run = (args: string): string =>
    execSync(`bun run ${CLI} ipc ${args}`, { encoding: 'utf-8', env: cliEnv() });

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

  it('migrate --dry-run reporta o plano sem escrever', () => {
    const work = join(testDir, 'work');
    const md = join(testDir, '.claude', 'projects', work.replace(/[\/.]/g, '-'), 'memory');
    mkdirSync(md, { recursive: true });
    writeFileSync(join(md, 'a.md'), '# a');

    const out = JSON.parse(run(`migrate project=work path=${work} --dry-run`));

    expect(out.status).toBe('dry-run');
    expect(out.plan.copies.map((c: { rel: string }) => c.rel)).toEqual(['a.md']);
    expect(existsSync(join(testDir, 'agent-memory', 'work'))).toBe(false);
  });
});
