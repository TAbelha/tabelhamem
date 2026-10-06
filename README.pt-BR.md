<div align="center">

# tabelhamem

**Ponte de memória compartilhada entre Claude Code e OpenCode.**

[English](README.md) · **Português**

[![TypeScript](https://img.shields.io/badge/language-TypeScript-3178c6?style=flat-square&logo=typescript&logoColor=white)](tsconfig.json)
[![Built with Bun](https://img.shields.io/badge/built%20with-Bun-fbf0df?style=flat-square&logo=bun&logoColor=black)](https://bun.sh)
[![Built with OpenTUI](https://img.shields.io/badge/built%20with-OpenTUI-ff69b4?style=flat-square)](https://github.com/anomalyco/opentui)
[![License: AGPL-3.0](https://img.shields.io/badge/license-AGPL--3.0-blue?style=flat-square)](LICENSE)

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/ianptkcs)

</div>

---

## O que é

O `tabelhamem` mantém um armazenamento de memória único pros seus agentes de
código: `~/agent-memory/<projeto>/`, markdown puro com frontmatter YAML. O
Claude Code alcança via symlink (I/O de arquivo transparente); o OpenCode
alcança via arquivo pointer `.tabelhamem.md` mais um plugin nativo que injeta
memória no system prompt, captura atividade de ferramentas e escreve resumos
estruturados de sessão com uso de tokens/custo — sem chamada de LLM, custo
zero. Uma TUI de terminal (OpenTUI + Solid) navega, busca e liga projetos, e
um CLI scriptável `tamem ipc ... --json` cobre automação.

## Como funciona

1. `tamem ipc link project=<slug> repo=<path>` migra a memória existente do
   Claude Code pro armazenamento compartilhado, faz o symlink do diretório
   de memória do Claude pra lá, escreve o pointer `.tabelhamem.md` (nunca
   toca no `AGENTS.md`) e adiciona o pointer ao gitignore. Vale pra todos
   os worktrees do repo.
2. O plugin OpenCode (`packages/plugin/src/opencode.js`, instalado em
   `~/.config/opencode/plugins/`) injeta a memória compartilhada em cada
   chamada do modelo, expõe as tools `memory_search`/`memory_write` e grava
   um resumo da sessão em `session.idle`/`session.compacted`/`session.deleted`.
3. A TUI (`tamem`, sem argumentos) lista projetos autodescobertos agrupados
   por diretório, mostra a saúde da ponte, busca na memória e liga/desliga
   pontes com `e`.

## Rodando localmente

Stack: monorepo TypeScript (turborepo), Bun como runtime e package manager.

```sh
bun install
bun run build
bun run test
```

O comando `tamem` é um wrapper em `packages/ipc/src/cli.ts`
(ver `~/.local/bin/tamem`). O plugin OpenCode instala com
`packages/plugin/install.sh`.

Outros comandos úteis:

```sh
tamem ipc list --json      # projetos descobertos
tamem ipc search query=x   # busca textual na memória
tamem ipc health           # saúde da ponte de cada projeto
```

## Desenvolvimento

Stack e comandos: ver _Rodando localmente_ acima. Testes:

```sh
bun run test      # unitários + e2e (vitest) + smoke da tui (bun test)
```

## Changelog

Veja [CHANGELOG.md](CHANGELOG.md) para o histórico de versões.

## Apoie o projeto

- **Global**: [ko-fi.com/ianptkcs](https://ko-fi.com/ianptkcs)
- **Brasil (Pix)**: escaneie o QR abaixo ou copie o código

  <img src="pix-qr.png" alt="Pix QR" width="200" />

  <details><summary>Código Pix (copiar)</summary>

  ```
  00020126580014BR.GOV.BCB.PIX01365ad933b0-dcdc-4525-a736-0759902aeec65204000053039865802BR5925Ian Patrick da Costa Soar6009SAO PAULO62140510tQA85x6Dov63041FB6
  ```

  </details>

## Licença

[AGPL-3.0](LICENSE) — copyleft forte: você pode usar, modificar e até
hospedar o tabelhamem comercialmente, mas qualquer versão modificada,
incluindo uma rodando como serviço de rede (SaaS), tem que continuar open
source sob a mesma licença.
