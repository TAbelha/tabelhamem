import { type Component } from 'solid-js';
import type { SearchMatch } from '@tabelhamem/ipc';

interface MemoryPanelProps {
  results: SearchMatch[];
  onSearch: (query: string) => void;
}

export const MemoryPanel: Component<MemoryPanelProps> = (props) => {
  return (
    <div>
      <h2>Memória</h2>
      <input
        type="text"
        placeholder="Buscar memória..."
        onInput={(e) => props.onSearch(e.currentTarget.value)}
      />
      <ul>
        {props.results.map((r) => (
          <li>
            <strong>{r.project}/{r.name}</strong>
            <p>{r.snippet}</p>
          </li>
        ))}
      </ul>
    </div>
  );
};
