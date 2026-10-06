import { type Component } from 'solid-js';
import type { ProjectInfo } from '@tabelhamem/ipc';
interface StatusPanelProps {
    project: ProjectInfo | null;
}
export declare const StatusPanel: Component<StatusPanelProps>;
export {};
