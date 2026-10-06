import { type Component } from 'solid-js';
import type { ProjectInfo } from '@tabelhamem/ipc';
interface ProjectListProps {
    projects: ProjectInfo[];
    onSelect: (project: ProjectInfo) => void;
}
export declare const ProjectList: Component<ProjectListProps>;
export {};
