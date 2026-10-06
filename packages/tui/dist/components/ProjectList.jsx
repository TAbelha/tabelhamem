export const ProjectList = (props) => {
    return (<div>
      <h2>Projetos</h2>
      <ul>
        {props.projects.map((p) => (<li onClick={() => props.onSelect(p)}>
            {p.slug} ({p.topicCount} tópicos)
          </li>))}
      </ul>
    </div>);
};
