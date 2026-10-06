import { type Component } from 'solid-js';
import type { ProjectInfo } from '@tabelhamem/ipc';

interface ProjectListProps {
  projects: ProjectInfo[];
  onSelect: (project: ProjectInfo) => void;
}

export const ProjectList: Component<ProjectListProps> = (props) => {
  return (
    <div>
      <h2>Projetos</h2>
      <ul>
        {props.projects.map((p) => (
          <li onClick={() => props.onSelect(p)}>
            {p.slug} ({p.topicCount} tópicos)
          </li>
        ))}
      </ul>
    </div>
  );
};
