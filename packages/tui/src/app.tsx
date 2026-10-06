import { createSignal, createMemo, For, Show } from "solid-js";
import { useKeyboard } from "@opentui/solid";
import { listProjects, listTopicFiles, readTopicFile, searchMemory } from "@tabelhamem/ipc";
import type { ProjectInfo, SearchMatch } from "@tabelhamem/ipc";

type Mode = "browse" | "search";
type Panel = "projects" | "files";

export function App() {
  const [projects, setProjects] = createSignal<ProjectInfo[]>([]);
  const [cursor, setCursor] = createSignal(0);
  const [panel, setPanel] = createSignal<Panel>("projects");
  const [files, setFiles] = createSignal<string[]>([]);
  const [fileCursor, setFileCursor] = createSignal(0);
  const [mode, setMode] = createSignal<Mode>("browse");
  const [query, setQuery] = createSignal("");
  const [results, setResults] = createSignal<SearchMatch[]>([]);
  const [resultIdx, setResultIdx] = createSignal(0);
  const [status, setStatus] = createSignal("");

  const selected = createMemo(() => {
    const list = projects();
    if (list.length === 0) return null;
    return list[Math.min(cursor(), list.length - 1)];
  });

  const activeFile = createMemo(() => {
    const list = files();
    if (list.length === 0) return "";
    return list[Math.min(fileCursor(), list.length - 1)];
  });

  const content = createMemo(() => {
    const p = selected();
    const f = activeFile();
    if (!p || !f) return "(nenhum arquivo)";
    return readTopicFile(p.slug, f);
  });

  const refresh = () => {
    const list = listProjects();
    setProjects(list);
    if (cursor() >= list.length) setCursor(Math.max(0, list.length - 1));
    refreshFiles();
    const p = selected();
    setStatus(p ? `${list.length} projetos` : "nenhum projeto em ~/agent-memory/");
  };

  const refreshFiles = () => {
    const p = selected();
    if (!p) {
      setFiles([]);
      return;
    }
    const list = listTopicFiles(p.slug);
    setFiles(list);
    if (fileCursor() >= list.length) setFileCursor(0);
  };

  const runSearch = (q: string) => {
    setQuery(q);
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setResults(searchMemory(q, "", ""));
    setResultIdx(0);
  };

  const move = (delta: number) => {
    if (panel() === "projects") {
      const n = projects().length;
      if (n === 0) return;
      setCursor((c) => (c + delta + n) % n);
      refreshFiles();
    } else {
      const n = mode() === "search" ? results().length : files().length;
      if (n === 0) return;
      if (mode() === "search") {
        setResultIdx((i) => (i + delta + n) % n);
      } else {
        setFileCursor((c) => (c + delta + n) % n);
      }
    }
  };

  useKeyboard((key) => {
    if (mode() === "search" && key.name !== "escape" && key.name !== "return") return;

    switch (key.name) {
      case "q":
        if (mode() === "browse") process.exit(0);
        break;
      case "escape":
        if (mode() === "search") {
          setMode("browse");
          setResults([]);
          setQuery("");
        }
        break;
      case "return":
        if (mode() === "search") {
          const r = results()[resultIdx()];
          if (r) {
            const idx = projects().findIndex((p) => p.slug === r.project);
            if (idx >= 0) {
              setCursor(idx);
              refreshFiles();
              const fi = files().indexOf(r.file);
              if (fi >= 0) setFileCursor(fi);
            }
          }
          setMode("browse");
        }
        break;
      case "/":
        if (mode() === "browse") {
          setMode("search");
          setQuery("");
          setResults([]);
          setResultIdx(0);
        }
        break;
      case "tab":
        setPanel((p) => (p === "projects" ? "files" : "projects"));
        break;
      case "j":
      case "down":
        move(1);
        break;
      case "k":
      case "up":
        move(-1);
        break;
      case "r":
        if (mode() === "browse") refresh();
        break;
    }
  });

  refresh();

  const currentResult = createMemo(() => {
    const list = results();
    if (list.length === 0) return null;
    return list[Math.min(resultIdx(), list.length - 1)];
  });

  return (
    <box flexDirection="column" width="100%" height="100%">
      <text>TAmem, memória compartilhada entre agentes</text>
      <box flexDirection="row" flexGrow={1}>
        <box border title="Projetos" width={28} flexShrink={0}>
          <For each={projects()}>
            {(p, i) => (
              <text>
                {`${i() === cursor() && panel() === "projects" ? "▸ " : "  "}${p.slug} (${p.topicCount})`}
              </text>
            )}
          </For>
          <Show when={projects().length === 0}>
            <text>(vazio)</text>
          </Show>
        </box>
        <box flexDirection="column" flexGrow={1}>
          <box border title="Ponte">
            <Show when={selected()} fallback={<text>(nenhum projeto selecionado)</text>}>
              <text>{`Slug:    ${selected()!.slug}`}</text>
              <text>{`Store:    ${selected()!.sharedDir}`}</text>
              <text>{`Tópicos:  ${selected()!.topicCount}`}</text>
            </Show>
          </box>
          <box border title="Memória" flexGrow={1}>
            <Show
              when={mode() === "search"}
              fallback={
                <>
                  <For each={files()}>
                    {(f, i) => (
                      <text>
                        {`${i() === fileCursor() && panel() === "files" ? "▸ " : "  "}${f}`}
                      </text>
                    )}
                  </For>
                  <Show when={files().length === 0}>
                    <text>(nenhum arquivo de memória)</text>
                  </Show>
                </>
              }
            >
              <input
                placeholder="buscar memória... (esc sai, enter abre)"
                value={query()}
                onInput={(value: string) => runSearch(value)}
              />
              <For each={results()}>
                {(r, i) => (
                  <text>
                    {`${i() === resultIdx() ? "▸ " : "  "}${r.project}/${r.name}`}
                  </text>
                )}
              </For>
              <Show when={query() && results().length === 0}>
                <text>(nenhum resultado)</text>
              </Show>
            </Show>
          </box>
        </box>
      </box>
      <box border title={activeFile() || "conteúdo"} maxHeight={12}>
        <scrollbox>
          <text>{content().slice(0, 2000)}</text>
        </scrollbox>
      </box>
      <text>{`q sai · / busca · tab painéis · j/k navega · r rescan · ${status()}`}</text>
      <Show when={mode() === "search" && currentResult()}>
        <text>{currentResult()!.snippet.slice(0, 300)}</text>
      </Show>
    </box>
  );
}
