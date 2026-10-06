import { createSignal, createMemo, For, Show } from "solid-js";
import { useKeyboard } from "@opentui/solid";
import {
  discoverProjects,
  listTopicFiles,
  readTopicFile,
  searchMemory,
  linkRepo,
  unlinkRepo,
} from "@tabelhamem/ipc";
import type { DiscoveredProject, SearchMatch } from "@tabelhamem/ipc";
import { C, markdownStyle } from "./theme.jsx";

type Mode = "browse" | "search";
// Ponte e memória dividem a coluna do meio; preview é a terceira coluna.
type Focus = "projects" | "bridge" | "files" | "preview";
type Middle = "bridge" | "files";

const ROW_WINDOW = 41;
const PREVIEW_LINES = 60;
const ROW_WIDTH = 27;

function rowLabel(p: DiscoveredProject): string {
  const full = p.org ? `${p.org}/${p.slug}` : p.slug;
  return full.length > ROW_WIDTH ? full.slice(0, ROW_WIDTH - 1) + "…" : full;
}

export function App() {
  const [projects, setProjects] = createSignal<DiscoveredProject[]>([]);
  const [cursor, setCursor] = createSignal(0);
  const [focus, setFocus] = createSignal<Focus>("projects");
  const [middle, setMiddle] = createSignal<Middle>("files");
  const [files, setFiles] = createSignal<string[]>([]);
  const [fileCursor, setFileCursor] = createSignal(0);
  const [scroll, setScroll] = createSignal(0);
  const [mode, setMode] = createSignal<Mode>("browse");
  const [editing, setEditing] = createSignal(false);
  const [query, setQuery] = createSignal("");
  const [results, setResults] = createSignal<SearchMatch[]>([]);
  const [resultIdx, setResultIdx] = createSignal(0);
  const [status, setStatus] = createSignal("");

  let inputRef: any = null;

  const selected = createMemo(() => {
    const list = projects();
    if (list.length === 0) return null;
    return list[Math.min(cursor(), list.length - 1)];
  });

  const currentOrg = createMemo(() => selected()?.org || "memória");

  const activeFile = createMemo(() => {
    const list = files();
    if (list.length === 0) return "";
    return list[Math.min(fileCursor(), list.length - 1)];
  });

  const previewText = createMemo(() => {
    if (mode() === "search") {
      const r = results()[Math.min(resultIdx(), results().length - 1)];
      if (!r) return query() ? "(nenhum resultado)" : "(digite e tecle enter)";
      return `# ${r.project}/${r.name}\n\n${r.snippet}`;
    }
    const p = selected();
    const f = activeFile();
    if (!p || !f) return "(nenhum arquivo de memória)";
    const lines = readTopicFile(p.slug, f).split("\n");
    const s = Math.min(scroll(), Math.max(0, lines.length - 1));
    return lines.slice(s, s + PREVIEW_LINES).join("\n");
  });

  const visibleProjects = createMemo(() => {
    const all = projects();
    if (all.length <= ROW_WINDOW) return all;
    let start = cursor() - Math.floor(ROW_WINDOW / 2);
    start = Math.max(0, Math.min(start, all.length - ROW_WINDOW));
    return all.slice(start, start + ROW_WINDOW);
  });

  const refresh = () => {
    const list = discoverProjects();
    setProjects(list);
    if (cursor() >= list.length) setCursor(Math.max(0, list.length - 1));
    refreshFiles();
    setStatus(`${list.length} repos em ~/codigo + memória`);
  };

  const refreshFiles = () => {
    const p = selected();
    setFiles(p ? listTopicFiles(p.slug) : []);
    setFileCursor(0);
    setScroll(0);
  };

  const runSearch = (q: string) => {
    setQuery(q);
    setResults(q.trim() ? searchMemory(q, "", "") : []);
    setResultIdx(0);
    setEditing(false);
  };

  const submitSearch = () => {
    runSearch(String(inputRef?.value ?? ""));
  };

  const jumpToResult = () => {
    const r = results()[resultIdx()];
    if (!r) return;
    const idx = projects().findIndex((p) => p.slug === r.project);
    if (idx >= 0) {
      setCursor(idx);
      refreshFiles();
      const fi = files().indexOf(r.file);
      if (fi >= 0) setFileCursor(fi);
    }
    setMode("browse");
    setResults([]);
    setFocus("preview");
    setScroll(0);
  };

  const doLink = () => {
    const p = selected();
    if (!p) return;
    if (p.memoryOnly || !p.repo) {
      setStatus(`${p.slug}: sem repo, nada pra ligar`);
      return;
    }
    try {
      linkRepo(p.repo, p.slug);
      setStatus(`${p.slug}: ligado`);
    } catch (err) {
      setStatus(`${p.slug}: falha ao ligar (${err})`);
    }
    refresh();
  };

  const doUnlink = () => {
    const p = selected();
    if (!p) return;
    if (p.memoryOnly || !p.repo) {
      setStatus(`${p.slug}: sem repo, nada pra desligar`);
      return;
    }
    try {
      unlinkRepo(p.repo, p.slug);
      setStatus(`${p.slug}: desligado`);
    } catch (err) {
      setStatus(`${p.slug}: falha ao desligar (${err})`);
    }
    refresh();
  };

  // Colunas: projects | meio (bridge/files) | preview. O meio lembra o
  // último bloco visitado.
  const focusColumn = (f: Focus): number => (f === "projects" ? 0 : f === "preview" ? 2 : 1);

  const moveColumn = (delta: number) => {
    const col = Math.max(0, Math.min(2, focusColumn(focus()) + delta));
    if (col === 0) setFocus("projects");
    else if (col === 2) setFocus("preview");
    else setFocus(middle());
  };

  const focusMiddle = (m: Middle) => {
    setMiddle(m);
    setFocus(m);
  };

  const step = (delta: number) => {
    switch (focus()) {
      case "projects": {
        const n = projects().length;
        if (n > 0) {
          setCursor((c) => (c + delta + n) % n);
          refreshFiles();
        }
        break;
      }
      case "files":
        if (mode() === "search") {
          const n = results().length;
          if (n > 0) setResultIdx((v) => (v + delta + n) % n);
        } else {
          const n = files().length;
          if (n > 0) setFileCursor((c) => (c + delta + n) % n);
        }
        break;
      case "preview":
        setScroll((s) => Math.max(0, s + delta));
        break;
      case "bridge":
        break;
    }
  };

  useKeyboard((key) => {
    const name = key.name;
    const ctrl = (key as any).ctrl === true;

    if (mode() === "search" && editing()) {
      // Com o input focado, só o esc sai daqui. O submit (enter) chega via
      // onSubmit do input, que lê o valor direto.
      if (name === "escape") {
        setMode("browse");
        setResults([]);
        setQuery("");
        setEditing(false);
      }
      return;
    }

    if (ctrl && name === "h") {
      moveColumn(-1);
      return;
    }
    if (ctrl && name === "l") {
      moveColumn(1);
      return;
    }
    if (ctrl && name === "j") {
      if (mode() === "search") {
        const n = results().length;
        if (n > 0) setResultIdx((v) => (v + 1) % n);
      } else {
        focusMiddle("files");
      }
      return;
    }
    if (ctrl && name === "k") {
      if (mode() === "search") {
        const n = results().length;
        if (n > 0) setResultIdx((v) => (v - 1 + n) % n);
      } else {
        focusMiddle("bridge");
      }
      return;
    }

    switch (name) {
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
      case "enter":
        if (mode() === "search") jumpToResult();
        else moveColumn(1);
        break;
      case "/":
        if (mode() === "browse") {
          setMode("search");
          setQuery("");
          setResults([]);
          setResultIdx(0);
          setEditing(true);
        } else {
          setEditing(true);
        }
        break;
      case "j":
      case "down":
        step(1);
        break;
      case "k":
      case "up":
        step(-1);
        break;
      case "r":
        if (mode() === "browse") refresh();
        break;
      case "l":
        if (mode() === "browse") doLink();
        break;
      case "u":
        if (mode() === "browse") doUnlink();
        break;
    }
  });

  refresh();

  const dot = (on: boolean) => (on ? "●" : "○");
  const dotColor = (on: boolean) => (on ? C.success : C.muted);
  const border = (f: Focus) => (focus() === f ? C.primary : C.muted);

  return (
    <box flexDirection="column" width="100%" height="100%">
      <text>
        <span style={{ fg: C.primary } as any}>TAbelhaMem</span>
        <span style={{ fg: C.muted } as any}> · memória compartilhada entre agentes</span>
      </text>
      <box flexDirection="row" flexGrow={1}>
        <box border borderColor={border("projects")} title={`Projetos · ${currentOrg()}`} width={34} flexShrink={0}>
          <For each={visibleProjects()}>
            {(p) => {
              const idx = projects().indexOf(p);
              return (
                <text>
                  {idx === cursor() && focus() === "projects" ? (
                    <span style={{ fg: C.primary } as any}>{`▸ ${rowLabel(p)} `}</span>
                  ) : (
                    <span style={{ fg: C.text } as any}>{`  ${rowLabel(p)} `}</span>
                  )}
                  <span style={{ fg: dotColor(p.linked) } as any}>{dot(p.linked)}</span>
                </text>
              );
            }}
          </For>
          <Show when={projects().length === 0}>
            <text>
              <span style={{ fg: C.muted } as any}>(vazio)</span>
            </text>
          </Show>
        </box>
        <box flexDirection="column" width={46} flexShrink={0}>
          <box border borderColor={border("bridge")} title="Ponte">
            <Show when={selected()} fallback={<text>sem seleção</text>}>
              <text>
                <span style={{ fg: C.text } as any}>{`${selected()!.org ? selected()!.org + "/" : ""}${selected()!.slug}`}</span>
              </text>
              <text>
                <span style={{ fg: dotColor(selected()!.linked) } as any}>{`${dot(selected()!.linked)} claude`}</span>
                <span style={{ fg: C.muted } as any}> · </span>
                <span style={{ fg: dotColor(selected()!.agentsSection) } as any}>{`${dot(selected()!.agentsSection)} agents`}</span>
              </text>
              <text>
                <span style={{ fg: C.muted } as any}>{`${selected()!.topicCount} tópicos`}</span>
              </text>
            </Show>
          </box>
          <box border borderColor={border("files")} title="Memória" flexGrow={1}>
            <Show
              when={mode() === "search"}
              fallback={
                <>
                  <For each={files()}>
                    {(f, i) => (
                      <text>
                        {i() === fileCursor() && focus() === "files" ? (
                          <span style={{ fg: C.primary } as any}>{`▸ ${f}`}</span>
                        ) : (
                          <span style={{ fg: C.text } as any}>{`  ${f}`}</span>
                        )}
                      </text>
                    )}
                  </For>
                  <Show when={files().length === 0}>
                    <text>
                      <span style={{ fg: C.muted } as any}>(nenhum arquivo de memória)</span>
                    </text>
                  </Show>
                </>
              }
            >
              <Show when={editing()}>
                <input
                  ref={(el: any) => (inputRef = el)}
                  focused={mode() === "search" && editing()}
                  placeholder="buscar memória... (enter busca, esc sai)"
                  onSubmit={() => submitSearch()}
                />
              </Show>
              <For each={results()}>
                {(r, i) => (
                  <text>
                    {i() === resultIdx() ? (
                      <span style={{ fg: C.primary } as any}>{`▸ ${r.project}/${r.name}`}</span>
                    ) : (
                      <span style={{ fg: C.text } as any}>{`  ${r.project}/${r.name}`}</span>
                    )}
                  </text>
                )}
              </For>
              <Show when={query() && results().length === 0}>
                <text>
                  <span style={{ fg: C.muted } as any}>(nenhum resultado)</span>
                </text>
              </Show>
            </Show>
          </box>
        </box>
        <box border borderColor={border("preview")} title={activeFile() || "preview"} flexGrow={1}>
          <markdown content={previewText()} syntaxStyle={markdownStyle()} />
        </box>
      </box>
      <text>
        <span style={{ fg: C.muted } as any}>{`q sai · / busca · ^h/^l colunas · ^j/^k ponte/memória · j/k navega · l liga · u desliga · r rescan · ${status()}`}</span>
      </text>
    </box>
  );
}
