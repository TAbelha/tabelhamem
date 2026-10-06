# tabelhamem v2 - Design Spec

**Date:** 2026-10-06
**Status:** Draft
**Author:** TAbelha

---

## Problem

Claude Code e OpenCode têm sistemas de memória incompatíveis. Claude Code usa `~/.claude/projects/<cwd>/memory/` (diretório por projeto, sem opção de mudar). OpenCode carrega `AGENTS.md` mas não tem memória por projeto.

O tabelhamem v1 tentou resolver isso com symlink + instrução no AGENTS.md, mas:
1. **Problema de compliance**: modelo não segue instrução do AGENTS.md de escrever resumo
2. **Falta de prova**: não há testes E2E que provem que a ponte funciona
3. **Falta de métricas**: não há dados sobre latência/custo
4. **Stack antiga**: Go/Bubble Tea + dependências internas (tabelhascaff, tabelhatuiui)

## Solution

Reestruturação completa do tabelhamem:
1. **Novo repo** em `github.com/TAbelha/tabelhamem` (org TAbelha, não TAbelhaDev)
2. **Stack moderna**: TypeScript + OpenTUI (Solid) + plugin OpenCode nativo
3. **Plugin OpenCode** resolve compliance: captura automática de sessões sem depender do modelo
4. **Hooks de fallback** garantem escrita mesmo se plugin falhar
5. **Testes E2E** provam que a ponte funciona
6. **Métricas** medem latência e tokens

## Architecture

### Monorepo Structure

```
tabelhamem/
├── packages/
│   ├── tui/          # OpenTUI (Solid) - interface interativa
│   ├── plugin/       # Plugin OpenCode (TS) - captura + tools
│   ├── ipc/          # CLI/IPC (TS) - scriptável, usado pelo plugin
│   └── hooks/        # Hooks de fallback (TS) - session.idle/deleted/compacted
├── package.json      # Workspace root
└── turbo.json        # Build orchestration
```

### Components

#### 1. Plugin OpenCode (`packages/plugin/`)

**Language:** TypeScript
**Runs:** Inside OpenCode process

**Responsibilities:**
- Captura `session.idle`, `session.deleted`, `session.compacted`
- Chama `tamem ipc` para escrever na memória compartilhada
- Expõe tools: `memory_search`, `memory_write`
- Escreve resumo da sessão na memória compartilhada

**Hooks:**
- `session.idle`: escreve resumo na memória
- `session.deleted`: escreve resumo final
- `session.compacted`: escreve resumo da compactação

**Tools:**
- `memory_search`: busca texto na memória compartilhada
- `memory_write`: escreve na memória compartilhada (manual)

#### 2. IPC/CLI (`packages/ipc/`)

**Language:** TypeScript
**Runs:** Standalone (chamado pelo plugin e scripts)

**Commands:**
- `tamem ipc link project=<slug> repo=<path> --json`
- `tamem ipc unlink project=<slug> repo=<path> --json`
- `tamem ipc status project=<slug> repo=<path> --json`
- `tamem ipc list --json`
- `tamem ipc search query=<term> type=<type> --json`
- `tamem ipc health --json`

**Responsibilities:**
- Gerencia symlinks (Claude Code)
- Gerencia seção no AGENTS.md (OpenCode)
- Busca texto nos arquivos de memória
- Health check da ponte

#### 3. Hooks de Fallback (`packages/hooks/`)

**Language:** TypeScript
**Runs:** Inside OpenCode process (plugin hooks)

**Hooks:**
- `session.idle`: escreve resumo na memória
- `session.deleted`: escreve resumo final
- `session.compacted`: escreve resumo da compactação

**Responsabilidade:**
- Garantir escrita mesmo se plugin principal falhar
- Redundância com plugin

#### 4. TUI (`packages/tui/`)

**Language:** TypeScript + OpenTUI + Solid
**Runs:** Standalone (terminal)

**Responsibilities:**
- Navegar projetos
- Buscar memória
- Ligar/desligar projetos
- Mostrar status da ponte

**Layout:**
- Sidebar: lista de projetos
- Painel direito: memória (arquivos + conteúdo)
- Header: título
- Footer: status + atalhos

### Data Flow

```
Claude Code:
  ~/.claude/projects/<cwd>/memory/ → symlink → ~/agent-memory/<slug>/

OpenCode:
  AGENTS.md → instrução → modelo lê/escreve ~/agent-memory/<slug>/

Plugin OpenCode:
  session.idle/deleted/compacted → tamem ipc → ~/agent-memory/<slug>/

TUI:
  OpenTUI → tamem ipc → ~/agent-memory/<slug>/
```

### Memory Format

Markdown + frontmatter YAML (compatível com Claude Code):

```markdown
---
type: feedback
tags: [worktree, git]
created: 2026-10-06
---

Conteúdo da memória...
```

### Shared Memory Path

`~/agent-memory/<slug>/`

### Claude Code Memory Path

`~/.claude/projects/<encoded-cwd>/memory/` (symlink para shared)

### AGENTS.md Section

```markdown
<!-- tabelhamem:start -->
## Memória Compartilhada

Este projeto usa memória compartilhada em `~/agent-memory/<slug>/`.

Instruções:
- Leia `~/agent-memory/<slug>/` no início da sessão
- Escreva resumos da sessão no final
- Use `tamem ipc search` para buscar memória
<!-- tabelhamem:end -->
```

## Testing

### Unit Tests

Cada módulo isolado:
- `packages/ipc/`: symlink, AGENTS.md, paths, busca
- `packages/plugin/`: captura de eventos, tools
- `packages/hooks/`: hooks de fallback
- `packages/tui/`: renderização, navegação

### E2E Tests

Prova a ponte de ponta a ponta:
1. Escreve num lado (Claude Code)
2. Lê no outro (OpenCode)
3. Valida conteúdo

### Benchmarks

- **Latência**: tempo de leitura/escrita na memória compartilhada
- **Tokens**: quanto contexto é injetado por sessão

## Migration Plan

### Phase 1: Setup
1. Criar novo repo em `github.com/TAbelha/tabelhamem`
2. Setup monorepo (Turborepo, package.json workspaces)
3. Setup build (TypeScript, OpenTUI, plugin OpenCode)

### Phase 2: Core
1. Implementar `packages/ipc/` (CLI/IPC)
2. Implementar `packages/hooks/` (hooks de fallback)
3. Implementar `packages/plugin/` (plugin OpenCode)

### Phase 3: TUI
1. Implementar `packages/tui/` (OpenTUI + Solid)
2. Integrar com IPC

### Phase 4: Testing
1. Testes unitários
2. Testes E2E
3. Benchmarks (latência, tokens)

### Phase 5: Migration
1. Migrar configuração do usuário
2. Atualizar documentação
3. Arquivar repo antigo (`TAbelhaDev/tabelhamem`)

## GitHub Plan

### New Repo
- **Org:** TAbelha
- **Name:** tabelhamem
- **Visibility:** Private (initially)
- **URL:** https://github.com/TAbelha/tabelhamem

### Archive Old Repo
- **Repo:** TAbelhaDev/tabelhamem
- **Action:** Archive (read-only)
- **Reason:** Deprecated, replaced by TAbelha/tabelhamem

## Success Criteria

1. **Plugin OpenCode** captura sessões e escreve na memória automaticamente
2. **Hooks de fallback** garantem escrita mesmo se plugin falhar
3. **Testes E2E** provam que a ponte funciona
4. **Benchmarks** mostram latência e tokens aceitáveis
5. **TUI** permite navegar, buscar, ligar/desligar projetos
6. **Repo antigo** arquivado
7. **Novo repo** ativo em TAbelha

## Open Questions

1. Nome do novo repo: `tabelhamem` ou outro?
2. Visibilidade: privado ou público?
3. Manter compatibilidade com config antiga ou quebrar?
4. Migrar dados existentes ou começar do zero?

## References

- OpenTUI: https://github.com/anomalyco/opentui
- OpenCode: https://opencode.ai
- mem0: https://github.com/mem0ai/mem0 (referência, não dependência)
