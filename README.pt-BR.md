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

## Por quê

O Claude Code tem um sistema de memória automático e embutido: injeta um
índice `MEMORY.md` por projeto mais arquivos-tópico tipados
(`feedback_*.md`/`project_*.md`/`reference_*.md`/`user_*.md`, com
frontmatter YAML) no início de cada sessão, guardados em
`~/.claude/projects/<cwd-escapado>/memory/` — um diretório por diretório de
trabalho exato, sem opção de configurar outro lugar. O OpenCode não tem
diretório de memória por projeto, mas carrega o `AGENTS.md` no início de
cada sessão — o `tamem` usa isso pra ensinar a ele o mesmo armazenamento.

O `tamem` faz a ponte entre os dois apontando ambos pro mesmo armazenamento
em markdown puro: `~/agent-memory/<projeto>/`, irmão de `~/jobs` (automação
do próprio usuário, não amarrada a nenhuma ferramenta específica). O
diretório de memória do Claude Code vira um symlink pra lá (transparente —
o Claude só faz I/O de arquivo normal); o OpenCode lê/escreve no mesmo lugar
através de um arquivo pointer `.tabelhamem.md` que o `tamem` mantém na raiz
do repo — o link nunca cria nem edita o `AGENTS.md` do repo.

Quando o repo é um repositório git, o `tamem` detecta automaticamente todos
os worktrees via `git worktree list` e liga, desfaz ou confere a saúde da
ponte pra cada um deles em uma única invocação, sem precisar rodar o
comando por worktree.

## Instalação

```bash
git clone https://github.com/TAbelha/tabelhamem.git
cd tabelhamem
bun install
```

O comando `tamem` é um wrapper em `packages/ipc/src/cli.ts`
(ver `~/.local/bin/tamem`).

### Desenvolvimento local

Um hook `post-commit` em `.githooks/` reinstala o wrapper do `tamem` em
`~/.local/bin/tamem` a cada commit, então o comando local nunca fica
desatualizado. O git não ativa o `.githooks/` de um repo sozinho — rode isso
uma vez por clone:

```bash
git config core.hooksPath .githooks
```

## Uso

Rodar `tamem` sem argumentos abre a TUI interativa pra navegar, buscar,
ligar e desligar projetos. O subcomando `ipc` continua disponível pra
scripts.

### TUI

```bash
# Abre a TUI interativa (o mesmo que `tamem tui`)
tamem
```

Projetos são descobertos automaticamente em
`~/codigo/{ea,wiv,tabelha,ufmg,pessoal,cpdq}/`, agrupados por diretório,
mais slugs de memória sem repo. Sem arquivo de config.

| Tecla | Ação |
|---|---|
| `q` | Sair |
| `/` | Buscar memória |
| `ctrl+h` / `ctrl+l` | Mover entre colunas |
| `ctrl+j` / `ctrl+k` | Focar memória / ponte |
| `j` / `k` | Navegar / rolar no painel focado |
| `enter` | Mover pra direita / abrir resultado da busca |
| `e` | Ligar/desligar o projeto selecionado |
| `r` | Rescan projetos |
| `esc` | Voltar / sair |

### IPC (JSON scriptável)

```bash
# Liga a memória de um projeto: migra os arquivos de memória do Claude Code
# já existentes pra ~/agent-memory/<projeto>/, faz o symlink do diretório
# do Claude Code pra lá, e escreve/atualiza as instruções no
# .tabelhamem.md do repo (nunca toca no AGENTS.md). Idempotente.
tamem ipc link project=tabelharadar repo=/home/ianptkcs/codigo/tabelhadev/tabelharadar --json

# Desfaz: o diretório de memória do Claude Code em <repo> volta a ter uma
# cópia real do conteúdo compartilhado (o diretório compartilhado em si não
# é tocado), e o arquivo pointer é removido.
tamem ipc unlink project=tabelharadar repo=/home/ianptkcs/codigo/tabelhadev/tabelharadar --json

# Confere a saúde da ponte pra um projeto
tamem ipc status project=tabelharadar repo=/home/ianptkcs/codigo/tabelhadev/tabelharadar --json

# Lista todos os projetos já em ponte
tamem ipc list --json

# Busca na memória de todos os projetos já ligados
tamem ipc search query=worktree type=feedback --json
```

## Métodos IPC

| Método | Filtros | Descrição |
|---|---|---|
| `global` | (nenhum) | Configura o armazenamento global compartilhado: cria `~/agent-memory/global/`, migra o AGENTS.md existente, cria symlink do Claude Code e atualiza o pointer do OpenCode |
| `link` | `project=`, `repo=` | Cria/atualiza a ponte de um projeto: migra + symlink + pointer `.tabelhamem.md` (com gitignore automático) |
| `unlink` | `project=`, `repo=` | Desfaz o `link` de um repo: restaura um diretório real, remove o pointer, não mexe no diretório compartilhado |
| `status` | `project=`, `repo=` (opcional) | Reporta se o symlink e o pointer estão certos |
| `list` | (nenhum) | Lista projetos descobertos com repo e status real da ponte |
| `search` | `query=`, `type=` (opcional), `project=` (opcional) | Busca texto em todos os projetos já ligados |

## Limitações

- O lado OpenCode da ponte é dirigido por instrução: o modelo lê o
  pointer `.tabelhamem.md` (e o plugin OpenCode injeta memória
  automaticamente), mas ler/escrever de fato o armazenamento
  compartilhado ainda depende do modelo seguir essa instrução a cada
  sessão.
- A detecção de worktrees requer `git` no `$PATH`. Se `git` não estiver
  disponível, o `tamem` opera em um único diretório (o caminho de `repo=`).
- `link` mescla arquivos pré-existentes no armazenamento compartilhado sem
  sobrescrever, e `unlink` restaura uma cópia real de volta — sem confronto
  manual nos dois sentidos.
