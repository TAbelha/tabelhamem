export const StatusPanel = (props) => {
    if (!props.project) {
        return <div>Nenhum projeto selecionado</div>;
    }
    return (<div>
      <h2>Status</h2>
      <p>Slug: {props.project.slug}</p>
      <p>Store: {props.project.sharedDir}</p>
      <p>Tópicos: {props.project.topicCount}</p>
      <p>Claude: {props.project.claudeLinked ? '✅' : '❌'}</p>
      <p>OpenCode: {props.project.opencodeLinked ? '✅' : '❌'}</p>
    </div>);
};
