import { performance } from 'perf_hooks';
import { execSync } from 'child_process';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

interface BenchmarkResult {
  operation: string;
  iterations: number;
  totalTimeMs: number;
  avgTimeMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
}

function percentile(sorted: number[], p: number): number {
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

function benchmark(name: string, fn: () => void, iterations: number = 100): BenchmarkResult {
  const times: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    fn();
    const end = performance.now();
    times.push(end - start);
  }

  times.sort((a, b) => a - b);

  const totalTimeMs = times.reduce((a, b) => a + b, 0);

  return {
    operation: name,
    iterations,
    totalTimeMs,
    avgTimeMs: totalTimeMs / iterations,
    p50Ms: percentile(times, 50),
    p95Ms: percentile(times, 95),
    p99Ms: percentile(times, 99),
  };
}

export function runBenchmarks(): void {
  const testDir = join(tmpdir(), `tabelhamem-bench-${Date.now()}`);
  const sharedDir = join(testDir, 'agent-memory', 'bench-project');
  const repoDir = join(testDir, 'repo');

  mkdirSync(sharedDir, { recursive: true });
  mkdirSync(repoDir, { recursive: true });

  // Setup: create test data
  for (let i = 0; i < 100; i++) {
    writeFileSync(join(sharedDir, `feedback_${i}.md`), `# Feedback ${i}\n\nConteúdo de teste ${i}\n`);
  }

  console.log('=== tabelhamem Benchmarks ===\n');

  // Benchmark: search
  const searchResult = benchmark('search', () => {
    execSync(
      `bun run packages/ipc/src/index.ts ipc search query=test --json`,
      { cwd: process.cwd(), encoding: 'utf-8', stdio: 'pipe' }
    );
  }, 50);

  console.log(`Search: avg=${searchResult.avgTimeMs.toFixed(2)}ms p50=${searchResult.p50Ms.toFixed(2)}ms p95=${searchResult.p95Ms.toFixed(2)}ms`);

  // Benchmark: list
  const listResult = benchmark('list', () => {
    execSync(
      `bun run packages/ipc/src/index.ts ipc list --json`,
      { cwd: process.cwd(), encoding: 'utf-8', stdio: 'pipe' }
    );
  }, 100);

  console.log(`List: avg=${listResult.avgTimeMs.toFixed(2)}ms p50=${listResult.p50Ms.toFixed(2)}ms p95=${listResult.p95Ms.toFixed(2)}ms`);

  // Benchmark: status
  const statusResult = benchmark('status', () => {
    execSync(
      `bun run packages/ipc/src/index.ts ipc status project=bench-project --json`,
      { cwd: process.cwd(), encoding: 'utf-8', stdio: 'pipe' }
    );
  }, 100);

  console.log(`Status: avg=${statusResult.avgTimeMs.toFixed(2)}ms p50=${statusResult.p50Ms.toFixed(2)}ms p95=${statusResult.p95Ms.toFixed(2)}ms`);

  // Benchmark: health
  const healthResult = benchmark('health', () => {
    execSync(
      `bun run packages/ipc/src/index.ts ipc health`,
      { cwd: process.cwd(), encoding: 'utf-8', stdio: 'pipe' }
    );
  }, 50);

  console.log(`Health: avg=${healthResult.avgTimeMs.toFixed(2)}ms p50=${healthResult.p50Ms.toFixed(2)}ms p95=${healthResult.p95Ms.toFixed(2)}ms`);

  // Token estimation
  const sampleFile = join(sharedDir, 'feedback_0.md');
  const content = require('fs').readFileSync(sampleFile, 'utf-8');
  const tokens = Math.ceil(content.length / 4);

  console.log(`\nToken estimation:`);
  console.log(`  Sample file: ${tokens} tokens`);
  console.log(`  100 files: ~${tokens * 100} tokens`);
  console.log(`  With frontmatter: ~${tokens * 100 * 1.2} tokens`);

  // Cleanup
  rmSync(testDir, { recursive: true, force: true });

  console.log('\n=== Benchmarks complete ===');
}

if (require.main === module) {
  runBenchmarks();
}
