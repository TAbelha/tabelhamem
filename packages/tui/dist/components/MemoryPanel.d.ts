import { type Component } from 'solid-js';
import type { SearchMatch } from '@tabelhamem/ipc';
interface MemoryPanelProps {
    results: SearchMatch[];
    onSearch: (query: string) => void;
}
export declare const MemoryPanel: Component<MemoryPanelProps>;
export {};
