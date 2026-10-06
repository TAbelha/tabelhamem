import type { IPCArgs, ProjectInfo } from './types.js';
import { getSharedDir, getTopicCount, checkClaudeSymlink, checkAgentsSection } from './store.js';
import { readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export function ipcList(_args: IPCArgs): number {
  const agentMemoryDir = join(homedir(), 'agent-memory');

  if (!existsSync(agentMemoryDir)) {
    console.log(JSON.stringify([]));
    return 0;
  }

  const entries = readdirSync(agentMemoryDir, { withFileTypes: true });
  const projects: ProjectInfo[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const slug = entry.name;
    const sharedDir = getSharedDir(slug);

    projects.push({
      slug,
      repo: '',
      sharedDir,
      topicCount: getTopicCount(slug),
      claudeLinked: checkClaudeSymlink(slug),
      opencodeLinked: checkAgentsSection(slug),
      agentsSection: checkAgentsSection(slug),
      worktreeCount: 0,
    });
  }

  console.log(JSON.stringify(projects, null, 2));
  return 0;
}

export function listProjects(): ProjectInfo[] {
  const agentMemoryDir = join(homedir(), 'agent-memory');

  if (!existsSync(agentMemoryDir)) {
    return [];
  }

  const entries = readdirSync(agentMemoryDir, { withFileTypes: true });
  const projects: ProjectInfo[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const slug = entry.name;
    const sharedDir = getSharedDir(slug);

    projects.push({
      slug,
      repo: '',
      sharedDir,
      topicCount: getTopicCount(slug),
      claudeLinked: checkClaudeSymlink(slug),
      opencodeLinked: checkAgentsSection(slug),
      agentsSection: checkAgentsSection(slug),
      worktreeCount: 0,
    });
  }

  return projects;
}
