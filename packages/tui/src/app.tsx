import { createSignal, createMemo, createEffect, For, Show } from "solid-js";
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

interface OrgRow {
  kind: "org";
  org: string;
}
interface ProjRow {
  kind: "proj";
  proj: DiscoveredProject;
}
type Row = OrgRow | ProjRow;

const PREVIEW_WIDTH = 300;
const SLUG_WIDTH = 28;

function slugLabel(slug: string): string {
  return slug.length > SLUG_WIDTH ? slug.slice(0, SLUG_WIDTH - 1) + "…" : slug;
}

export function App(props?: { initialSlug?: string }) {
  const [projects, setProjects] = createSignal<DiscoveredProject[]>([]);
  const [cursor, setCursor] = createSignal(0);
  const [focus, setFocus] = createSignal<Focus>("projects");
  const [middle, setMiddle] = createSignal<Middle>("files");
  const [files, setFiles] = createSignal<string[]>([]);
  const [fileCursor, setFileCursor] = createSignal(0);
  const [mode, setMode] = createSignal<Mode>("browse");
  const [editing, setEditing] = createSignal(false);
  const [query, setQuery] = createSignal("");
  const [results, setResults] = createSignal<SearchMatch[]>([]);
  const [resultIdx, setResultIdx] = createSignal(0);
  const [status, setStatus] = createSignal("");

  let inputRef: any = null;
  let scrollRef: any = null;
  let projScrollRef: any = null;
  let fileScrollRef: any = null;

  // Volta ao topo do preview ao trocar de arquivo/projeto.
  createEffect(() => {
    activeFile();
    selected();
    try {
      scrollRef?.scrollTo(0);
    } catch {}
  });

  // Mantém o cursor visível nas listas roláveis.
  createEffect(() => {
    const y = cursor();
    rows();
    try {
      projScrollRef?.scrollTo({ x: 0, y });
    } catch {}
  });

  createEffect(() => {
    const y = mode() === "search" ? resultIdx() : fileCursor();
    files();
    results();
    try {
      fileScrollRef?.scrollTo({ x: 0, y });
    } catch {}
  });

  const rows = createMemo<Row[]>(() => {
    const out: Row[] = [];
    let last = "\0";
    for (const p of projects()) {
      const label = p.org === "" ? "memória" : p.org;
      if (label !== last) {
        out.push({ kind: "org", org: label });
        last = label;
      }
      out.push({ kind: "proj", proj: p });
    }
    return out;
  });

  const selected = createMemo(() => {
    const r = rows()[cursor()];
    return r && r.kind === "proj" ? r.proj : null;
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
    return readTopicFile(p.slug, f)
      .split("\n")
      .map((l) => (l.length > PREVIEW_WIDTH ? l.slice(0, PREVIEW_WIDTH - 1) + "…" : l))
      .join("\n");
  });

  const refresh = () => {
    const list = discoverProjects();
    setProjects(list);
    const r = rows();
    let c = cursor();
    if (c >= r.length) c = Math.max(0, r.length - 1);
    // Slug inicial (só teste): posiciona o cursor nele no primeiro refresh.
    if (!initialized && props?.initialSlug) {
      initialized = true;
      const idx = r.findIndex((x) => x.kind === "proj" && x.proj.slug === props.initialSlug);
      if (idx >= 0) c = idx;
    }
    // Cursor nunca repousa num header: avança pro próximo projeto.
    if (r.length > 0 && r[c]?.kind !== "proj") {
      const next = r.findIndex((x, i) => i >= c && x.kind === "proj");
      c = next >= 0 ? next : r.findIndex((x) => x.kind === "proj");
      if (c < 0) c = 0;
    }
    setCursor(c);
    refreshFiles();
    setStatus(`${list.length} repos em ~/codigo + memória`);
  };

  // Slug inicial (só teste): posiciona o cursor nele no primeiro refresh.
  let initialized = false;

  const refreshFiles = () => {
    const p = selected();
    setFiles(p ? listTopicFiles(p.slug) : []);
    setFileCursor(0);
  };

  const moveCursor = (delta: number) => {
    const r = rows();
    if (r.length === 0) return;
    let i = cursor();
    for (let step = 0; step < r.length; step++) {
      i = (i + delta + r.length) % r.length;
      if (r[i].kind === "proj") break;
    }
    setCursor(i);
    refreshFiles();
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
    const idx = rows().findIndex((x) => x.kind === "proj" && x.proj.slug === r.project);
    if (idx >= 0) {
      setCursor(idx);
      refreshFiles();
      const fi = files().indexOf(r.file);
      if (fi >= 0) setFileCursor(fi);
    }
    setMode("browse");
    setResults([]);
    setFocus("preview");
  };

  const doToggle = () => {
    const p = selected();
    if (!p) return;
    if (p.memoryOnly || !p.repo) {
      setStatus(`${p.slug}: sem repo, nada pra alternar`);
      return;
    }
    try {
      if (p.linked) {
        unlinkRepo(p.repo, p.slug);
        setStatus(`${p.slug}: desligado`);
      } else {
        linkRepo(p.repo, p.slug);
        setStatus(`${p.slug}: ligado`);
      }
    } catch (err) {
      setStatus(`${p.slug}: falha (${err})`);
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
      case "projects":
        moveCursor(delta);
        break;
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
        try {
          scrollRef?.scrollBy({ x: 0, y: delta });
        } catch {}
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
      case "e":
        if (mode() === "browse") doToggle();
        break;
    }
  });

  refresh();

  const dot = (on: boolean) => (on ? "●" : "○");
  const dotColor = (on: boolean) => (on ? C.success : C.muted);
  const border = (f: Focus) => (focus() === f ? C.primary : C.muted);

  return (
    <box flexDirection="column" width="100%" height="100%">
      <text flexShrink={0}>
        <span style={{ fg: C.primary } as any}>TAbelhaMem</span>
        <span style={{ fg: C.muted } as any}> · memória compartilhada entre agentes</span>
      </text>
      <box flexDirection="row" flexGrow={1}>
        <box border borderColor={border("projects")} title={`Projetos · ${currentOrg()}`} width={34} flexShrink={0} minHeight={0}>
          <scrollbox ref={(el: any) => (projScrollRef = el)} flexGrow={1} flexShrink={1} minHeight={0} scrollbarOptions={{ visible: false } as any}>
          <For each={rows()}>
            {(r, i) =>
              r.kind === "org" ? (
                <text>
                  <span style={{ fg: C.muted } as any}>{`${r.org}/`}</span>
                </text>
              ) : (
                <text>
                  {i() === cursor() && focus() === "projects" ? (
                    <span style={{ fg: C.primary } as any}>{`▸ ${slugLabel(r.proj.slug)} `}</span>
                  ) : (
                    <span style={{ fg: C.text } as any}>{`  ${slugLabel(r.proj.slug)} `}</span>
                  )}
                  <span style={{ fg: dotColor(r.proj.linked) } as any}>{dot(r.proj.linked)}</span>
                </text>
              )
            }
          </For>
          </scrollbox>
          <Show when={rows().length === 0}>
            <text>
              <span style={{ fg: C.muted } as any}>(vazio)</span>
            </text>
          </Show>
        </box>
        <box flexDirection="column" width={46} flexShrink={0} minHeight={0}>
          <box border borderColor={border("bridge")} title="Ponte" flexShrink={0}>
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
          <box border borderColor={border("files")} title={`Memória (${files().length})`} flexGrow={1} minHeight={0}>
            <Show when={mode() === "search" && editing()}>
              <input
                ref={(el: any) => (inputRef = el)}
                focused={mode() === "search" && editing()}
                placeholder="buscar memória... (enter busca, esc sai)"
                onSubmit={() => submitSearch()}
              />
            </Show>
            <scrollbox ref={(el: any) => (fileScrollRef = el)} flexGrow={1} flexShrink={1} minHeight={0} scrollbarOptions={{ visible: false } as any}>
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
            </scrollbox>
          </box>
        </box>
        <box border borderColor={border("preview")} title={activeFile() || "preview"} flexGrow={1} flexShrink={1} minHeight={0}>
          <scrollbox ref={(el: any) => (scrollRef = el)} flexGrow={1} flexShrink={1} minHeight={0} scrollbarOptions={{ visible: false } as any}>
            <markdown content={previewText()} syntaxStyle={markdownStyle()} />
          </scrollbox>
        </box>
      </box>
      <text flexShrink={0}>
        <span style={{ fg: C.muted } as any}>{`q sai · / busca · ^h/^l colunas · ^j/^k ponte/memória · j/k navega · e liga/desliga · r rescan · ${status()}`}</span>
      </text>
    </box>
  );
}
