import { listProjects, searchMemory } from '@tabelhamem/ipc';
import type { ProjectInfo, SearchMatch } from '@tabelhamem/ipc';
import { render } from 'solid-js/web';
import { createSignal } from 'solid-js';
import { ProjectList } from './components/ProjectList.jsx';
import { MemoryPanel } from './components/MemoryPanel.jsx';
import { StatusPanel } from './components/StatusPanel.jsx';

export async function runRealTUI(): Promise<void> {
  const [projects, setProjects] = createSignal<ProjectInfo[]>([]);
  const [selectedProject, setSelectedProject] = createSignal<ProjectInfo | null>(null);
  const [searchResults, setSearchResults] = createSignal<SearchMatch[]>([]);
  const [searchQuery, setSearchQuery] = createSignal('');

  const loadProjects = async () => {
    const result = listProjects();
    setProjects(result);
  };

  const searchMemoryHandler = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    const result = searchMemory(query, '', '');
    setSearchResults(result);
  };

  await loadProjects();

  const container = document.getElementById('app');
  if (!container) {
    console.error('Container #app não encontrado');
    return;
  }

  render(() => (
    <div>
      <h1>tabelhamem - memória compartilhada entre agentes</h1>
      <div style={{ display: 'flex' }}>
        <div style={{ width: '30%' }}>
          <ProjectList
            projects={projects()}
            onSelect={(p) => setSelectedProject(p)}
          />
        </div>
        <div style={{ width: '70%' }}>
          <StatusPanel project={selectedProject()} />
          <MemoryPanel
            results={searchResults()}
            onSearch={(q) => {
              setSearchQuery(q);
              searchMemoryHandler(q);
            }}
          />
        </div>
      </div>
    </div>
  ), container);
}
