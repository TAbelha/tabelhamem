<div align="center">

# tabelhamem

**Shared memory bridge between Claude Code and OpenCode.**

**English** · [Português](README.pt-BR.md)

[![TypeScript](https://img.shields.io/badge/language-TypeScript-3178c6?style=flat-square&logo=typescript&logoColor=white)](tsconfig.json)
[![Built with Bun](https://img.shields.io/badge/built%20with-Bun-fbf0df?style=flat-square&logo=bun&logoColor=black)](https://bun.sh)
[![Built with OpenTUI](https://img.shields.io/badge/built%20with-OpenTUI-ff69b4?style=flat-square)](https://github.com/anomalyco/opentui)
[![License: AGPL-3.0](https://img.shields.io/badge/license-AGPL--3.0-blue?style=flat-square)](LICENSE)

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/ianptkcs)

</div>

---

## What it is

`tabelhamem` keeps one shared memory store for your coding agents:
`~/agent-memory/<project>/`, plain markdown with YAML frontmatter. Claude Code
reaches it through a symlink (transparent file I/O); OpenCode reaches it
through a `.tabelhamem.md` pointer file plus a native plugin that injects
memory into the system prompt, captures tool activity, and writes structured
session digests with token/cost usage — no LLM call, zero extra cost. A
terminal UI (OpenTUI + Solid) browses, searches, and links projects, and a
scriptable `tamem ipc ... --json` CLI covers automation.

## How it works

1. `tamem ipc link project=<slug> repo=<path>` migrates existing Claude Code
   memory into the shared store, symlinks Claude's memory dir to it, writes
   the `.tabelhamem.md` pointer (never touches `AGENTS.md`), and gitignores
   the pointer. Works across every git worktree of the repo.
2. The OpenCode plugin (`packages/plugin/src/opencode.js`, installed to
   `~/.config/opencode/plugins/`) injects the shared memory into each model
   call, exposes `memory_search`/`memory_write` tools, and records a session
   digest on `session.idle`/`session.compacted`/`session.deleted`.
3. The TUI (`tamem`, no args) lists auto-discovered projects grouped by
   directory, shows bridge health, searches memory, and toggles bridges
   with `e`.

## Running locally

Stack: TypeScript monorepo (turborepo), Bun as runtime and package manager.

```sh
bun install
bun run build
bun run test
```

The `tamem` command is a wrapper around `packages/ipc/src/cli.ts`
(see `~/.local/bin/tamem`). The OpenCode plugin installs with
`packages/plugin/install.sh`.

Other useful commands:

```sh
tamem ipc list --json      # discovered projects
tamem ipc search query=x   # full-text search across memory
tamem ipc health           # bridge health for every project
```

## Development

Stack and commands: see _Running locally_ above. Tests:

```sh
bun run test      # unit + e2e (vitest) + tui smoke tests (bun test)
```

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for the version history.

## Support the project

- **Global**: [ko-fi.com/ianptkcs](https://ko-fi.com/ianptkcs)
- **Brazil (Pix)**: scan the QR below or copy the code

  <img src="pix-qr.png" alt="Pix QR" width="200" />

  <details><summary>Pix code (copy)</summary>

  ```
  00020126580014BR.GOV.BCB.PIX01365ad933b0-dcdc-4525-a736-0759902aeec65204000053039865802BR5925Ian Patrick da Costa Soar6009SAO PAULO62140510tQA85x6Dov63041FB6
  ```

  </details>

## License

[AGPL-3.0](LICENSE) — strong copyleft: you may use, modify and even host
tabelhamem commercially, but any modified version, including one running as a
network service (SaaS), has to stay open source under the same license.
