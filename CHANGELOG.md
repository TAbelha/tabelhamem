# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.3] - 2026-10-19

### Changed
- TUI tests are now hermetic: use `process.env.HOME || homedir()` in IPC
  package to allow override in tests, and create filesystem fixtures in
  `beforeEach` instead of depending on real `~/codigo` directory.
- TUI tests generate 20 repos + memory files for scrolling tests, making
  them independent of the developer's machine.
- Preview test adjusted to be more robust with extra settle rounds and
  check content instead of title.

## [2.0.0] - 2026-10-19

### Added
- OpenCode V2 plugin (`packages/plugin/src/opencode.js`, installed to
  `~/.config/opencode/plugins/` via `install.sh`): injects shared memory
  into the system prompt, exposes `memory_search`/`memory_write` tools,
  captures file mutations as observations, and writes structured session
  digests with token/cost usage on `session.idle`/`session.compacted`.
  No LLM call, zero extra cost.
- Bridge instructions moved to a `.tabelhamem.md` pointer file in each
  repo instead of a section in `AGENTS.md`. `link` never creates or
  edits `AGENTS.md`, so no stray `AGENTS.md` is born from linking; it
  also cleans up legacy `AGENTS.md` blocks left by previous versions
  (deleting the file only if left blank).
- `global` IPC method: idempotent setup of the shared global memory
  store at `~/agent-memory/global/`. Migrates existing
  `~/.config/opencode/AGENTS.md` and `~/.claude/memory/` content into
  the store, symlinks both to the shared store.
- Interactive TUI (OpenTUI + Solid): 3-panel layout (projects sidebar,
  bridge status, memory browser) with integrated search, link/unlink
  forms, inline scrollable file viewer, and vim-like navigation.
- `tamem` (no args) now launches the TUI instead of printing usage and
  exiting with code 1. The CLI wraps `packages/ipc/src/cli.ts`.
- `searchMemory()` extracted as a reusable core shared by both IPC and
  TUI search modes.

### Changed
- Automatic git worktree detection: `link`, `unlink`, and `status` now
  cover all worktrees of a repo in a single invocation via
  `git worktree list`.
- Removed the limitation that `link` must be re-run per worktree.
- The pointer file is now ignored locally via `$GIT_DIR/info/exclude`
  instead of `.gitignore`. `link` no longer touches `.gitignore` (and
  removes the legacy line where a previous version had written one), so
  no tracked file changes when bridging a shared repo.
- Go v1 sources removed; the repo is a TypeScript monorepo (turborepo)
  with Bun as runtime and package manager.

## [0.3.0] - 2026-09-14

### Added
- Automatic git worktree detection: `link`, `unlink`, and `status` now cover
  all worktrees of a repo in a single invocation via `git worktree list`.
- `linkResult`, `unlinkResult`, and `statusResult` include a `worktrees`
  array with per-worktree bridge state.
- `gitWorktrees()` helper in store with graceful fallback when `git` is
  unavailable.
- Test suite: 42 tests covering store helpers, frontmatter parsing,
  snippet extraction, link/unlink flows, and AGENTS.md section management.

### Changed
- Removed the limitation that `link` must be re-run per worktree.

## [0.2.0] - 2026-09-09

### Added
- `search` method: full-text search across all bridged projects, with
  optional `type=` and `project=` filters.
- `unlink` method: reverses `link` for one repo, restoring a real directory
  and removing the AGENTS.md section.

### Fixed
- Build now depends on the published `tabelhascaff` v0.7.1 instead of a
  local `replace` directive.

## [0.1.0] - 2026-09-09

### Added
- Initial release: `link`, `status`, and `list` IPC methods.
- Bilingual README (English + Portuguese).
- CI and release workflows.
