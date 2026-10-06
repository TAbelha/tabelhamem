<div align="center">

# tabelhamem

**Shared agent memory bridge between Claude Code and OpenCode.**

**English** · [Português](README.pt-BR.md)

[![TypeScript](https://img.shields.io/badge/language-TypeScript-3178c6?style=flat-square&logo=typescript&logoColor=white)](tsconfig.json)
[![Built with Bun](https://img.shields.io/badge/built%20with-Bun-fbf0df?style=flat-square&logo=bun&logoColor=black)](https://bun.sh)
[![Built with OpenTUI](https://img.shields.io/badge/built%20with-OpenTUI-ff69b4?style=flat-square)](https://github.com/anomalyco/opentui)
[![License: AGPL-3.0](https://img.shields.io/badge/license-AGPL--3.0-blue?style=flat-square)](LICENSE)

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/ianptkcs)

</div>

---

## Why

Claude Code has a built-in, automatic memory system: it injects a
project-scoped `MEMORY.md` index plus typed topic files
(`feedback_*.md`/`project_*.md`/`reference_*.md`/`user_*.md`, YAML
frontmatter) at the start of every session, stored at
`~/.claude/projects/<escaped-cwd>/memory/` — one directory per exact working
directory, with no way to point it elsewhere. OpenCode has no per-project
memory dir of its own, but it auto-loads `AGENTS.md` at session start —
tamem uses that to teach it the same store.

`tamem` bridges the two by making both point at the same plain-markdown
store: `~/agent-memory/<project>/`, sibling to `~/jobs` (the user's own
automation state, not owned by any single tool). Claude Code's per-project
memory directory becomes a symlink into it (transparent — Claude just does
normal file I/O); OpenCode reads/writes the same location through a
`.tabelhamem.md` pointer file `tamem` maintains in the repo root — the link
never creates or edits the repo's `AGENTS.md`.

When the repo is a git repository, `tamem` automatically detects all git
worktrees via `git worktree list` and links, unlinks, or checks the bridge
health for every one of them in a single invocation — no need to re-run
per worktree.

## Install

```bash
git clone https://github.com/TAbelha/tabelhamem.git
cd tabelhamem
bun install
```

The `tamem` command is a wrapper around `packages/ipc/src/cli.ts`:

```bash
# ~/.local/bin/tamem
BUN_BIN="/home/ianptkcs/.local/share/mise/installs/bun/latest/bin/bun"
exec "$BUN_BIN" "$REPO/packages/ipc/src/cli.ts" "$@"
```

### Local development

A `post-commit` hook in `.githooks/` reinstalls the `tamem` wrapper to
`~/.local/bin/tamem` after every commit, so the local command never goes
stale. Git doesn't enable a repo's `.githooks/` automatically on clone — run
this once per clone:

```bash
git config core.hooksPath .githooks
```

## Usage

Running `tamem` with no arguments launches the interactive TUI for browsing,
searching, linking, and unlinking projects. The `ipc` subcommand remains
available for scripting.

### TUI

```bash
# Launch the interactive TUI (same as `tamem tui`)
tamem
```

Projects are discovered automatically from `~/codigo/{ea,wiv,tabelha,ufmg,pessoal,cpdq}/`,
grouped by directory, plus memory-only slugs. No config file needed.

| Key | Action |
|---|---|
| `q` | Quit |
| `/` | Search memory |
| `ctrl+h` / `ctrl+l` | Move between columns |
| `ctrl+j` / `ctrl+k` | Focus memory / bridge |
| `j` / `k` | Navigate / scroll in the focused panel |
| `enter` | Move right / open search result |
| `e` | Link/unlink the selected project |
| `r` | Rescan projects |
| `esc` | Back / quit |

### IPC (scriptable JSON)

```bash
# Link a project's memory: migrates existing Claude Code memory files into
# ~/agent-memory/<project>/, symlinks Claude's own memory dir to it, and
# writes/updates the bridge instructions in <repo>/.tabelhamem.md. Idempotent.
tamem ipc link project=tabelharadar repo=/home/ianptkcs/codigo/tabelhadev/tabelharadar --json

# Undo it: <repo>'s Claude Code memory dir gets a real copy of the current
# shared content back (the shared dir itself is left alone), and the
# pointer file is removed (deleted if left empty).
tamem ipc unlink project=tabelharadar repo=/home/ianptkcs/codigo/tabelhadev/tabelharadar --json

# Check the bridge's health for one project
tamem ipc status project=tabelharadar repo=/home/ianptkcs/codigo/tabelhadev/tabelharadar --json

# List every project currently bridged
tamem ipc list --json

# Search memory across every bridged project
tamem ipc search query=worktree type=feedback --json
```

## IPC Methods

| Method | Filters | Description |
|---|---|---|
| `global` | (none) | Sets up the shared global memory store: creates `~/agent-memory/global/`, migrates existing `AGENTS.md`, symlinks Claude Code, and updates the OpenCode pointer |
| `link` | `project=`, `repo=` | Creates/updates the bridge for a project: migrate + symlink + `.tabelhamem.md` pointer (also gitignores the pointer) |
| `unlink` | `project=`, `repo=` | Reverses `link` for one repo: restores a real directory, removes the pointer file, leaves the shared dir alone |
| `status` | `project=`, `repo=` (optional) | Reports whether the symlink and pointer file are in place |
| `list` | (none) | Lists discovered projects with repo and real bridge status |
| `search` | `query=`, `type=` (optional), `project=` (optional) | Full-text search across every bridged project's memory files |

## Limitations

- The OpenCode side of the bridge is instruction-driven: the model reads
  the `.tabelhamem.md` pointer (and the OpenCode plugin injects memory
  automatically), but actually reading/writing the shared store still
  depends on the model following that instruction each session.
- Worktree detection requires `git` on `$PATH`. If `git` is unavailable,
  `tamem` falls back to operating on a single directory (the `repo=` path).
- `link` merges pre-existing memory files into the shared store without
  overwriting, and `unlink` restores a real copy back — no manual conflict
  resolution needed in either direction.
