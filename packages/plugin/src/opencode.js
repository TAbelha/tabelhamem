// tabelhamem — ponte de memória compartilhada para OpenCode.
//
// Plugin V2 (opencode v2.x). Fonte de verdade deste arquivo: packages/plugin/src/opencode.js
// Instalacao: ./install.sh copia para ~/.config/opencode/plugins/tabelhamem.js
//
// O que faz:
//   1. injeta a memoria compartilhada no system prompt de cada modelo call (lado leitura)
//   2. expoe as tools memory_search / memory_write
//   3. captura mutacoes de arquivo (write/edit/patch/bash) como observacoes
//   4. em session.idle / session.compacted escreve um resumo estruturado da sessao
//      no armazenamento compartilhado, junto com o consumo de tokens/custo observado
//
// Nao usa LLM: resumo e digest estruturado (custo zero). O resumo em prosa continua
// sendo papel do modelo via instrucao no AGENTS.md (`tamem ipc link`).

import fs from "node:fs"
import path from "node:path"
import os from "node:os"

const MAX_CONTEXT_CHARS = 3000 // teto de injecao por model call (~750 tokens)
const RECENT_SESSIONS = 3
const INTERESTING_TOOLS = new Set(["write", "edit", "patch", "bash", "memory_write"])
const MAX_DIGESTS_PER_SESSION = 400 // evita regravar um digest infinitamente

function sharedDir(slug) {
  return path.join(os.homedir(), "agent-memory", slug)
}

function shortId(id) {
  return String(id || "unknown").replace(/[^a-zA-Z0-9]/g, "").slice(0, 12) || "unknown"
}

function truncate(text, max) {
  const s = String(text ?? "")
  return s.length <= max ? s : s.slice(0, max) + "…"
}

function readDirSafe(dir) {
  try {
    return fs.readdirSync(dir).filter((f) => f.endsWith(".md")).sort()
  } catch {
    return []
  }
}

// Monta o trecho de memoria injetado no system prompt. Prioriza arquivos de
// topico (feedback/reference/user/project) e os resumos de sessao mais recentes,
// com teto de caracteres para nao inflar o custo por chamada.
function buildMemoryContext(dir) {
  const files = readDirSafe(dir)
  if (files.length === 0) return ""

  const topics = files.filter((f) => !f.startsWith("session-"))
  const sessions = files.filter((f) => f.startsWith("session-")).slice(-RECENT_SESSIONS).reverse()

  const parts = []
  let budget = MAX_CONTEXT_CHARS

  for (const f of [...topics, ...sessions]) {
    if (budget <= 0) break
    let content = ""
    try {
      content = fs.readFileSync(path.join(dir, f), "utf-8")
    } catch {
      continue
    }
    const chunk = `### ${f}\n${truncate(content, Math.min(budget, 1200))}`
    parts.push(chunk)
    budget -= chunk.length
  }

  if (parts.length === 0) return ""
  return `Memoria compartilhada deste projeto (dir: ${dir}). Leia antes de responder sobre historico, preferencias ou decisoes passadas:\n\n${parts.join("\n\n")}`
}

function appendObservation(dir, entry) {
  try {
    fs.mkdirSync(dir, { recursive: true })
    const file = path.join(dir, "observations.md")
    fs.appendFileSync(file, entry)
  } catch (err) {
    console.error("[tabelhamem] falha ao gravar observacao:", err?.message ?? err)
  }
}

function writeSessionDigest(dir, digest) {
  try {
    fs.mkdirSync(dir, { recursive: true })
    const day = digest.ended.slice(0, 10)
    const file = path.join(dir, `session-${day}-${digest.short}.md`)

    let existing = ""
    if (fs.existsSync(file)) existing = fs.readFileSync(file, "utf-8")
    if (existing.split("\n").length > MAX_DIGESTS_PER_SESSION) return

    fs.appendFileSync(file, digest.body)
    return file
  } catch (err) {
    console.error("[tabelhamem] falha ao gravar resumo de sessao:", err?.message ?? err)
  }
}

export default {
  id: "tabelhamem",

  async setup(ctx) {
    const directory = ctx.location?.directory ?? process.cwd()
    const slug = path.basename(directory)
    const shared = sharedDir(slug)

    // Nao cria o diretor aqui: setup roda por cada local aberto, entao criar no
    // setup polui ~/agent-memory com dirs vazios. O dir nasce no primeiro write;
    // o lado leitura tolera dir ausente (readDirSafe devolve []).
    // Estado por sessao: consumo acumulado (tokens/custo) e pedidos observados.
    const usage = new Map()

    const usageFor = (sessionID) => {
      let u = usage.get(sessionID)
      if (!u) {
        u = { input: 0, output: 0, reasoning: 0, cacheRead: 0, cacheWrite: 0, cost: 0, steps: 0 }
        usage.set(sessionID, u)
      }
      return u
    }

    // 1. Lado leitura: injeta a memoria no system prompt de cada model call.
    await ctx.session.hook("context", (event) => {
      const text = buildMemoryContext(shared)
      if (text) event.system.push({ type: "text", text })
    })

    // 2. Tools expostas ao modelo.
    await ctx.tool.transform((editor) => {
      editor.add({
        name: "memory_search",
        description:
          "Busca texto na memoria compartilhada deste projeto (~agent-memory). Use quando precisar de historico, preferencias ou decisoes passadas.",
        input: {
          type: "object",
          properties: {
            query: { type: "string", description: "termo de busca" },
            type: { type: "string", description: "filtro opcional: session, observations, ou nome de arquivo" },
          },
          required: ["query"],
        },
        execute: async (input) => {
          const query = String(input?.query ?? "").toLowerCase()
          const type = String(input?.type ?? "")
          const hits = []
          for (const f of readDirSafe(shared)) {
            if (type && !f.includes(type)) continue
            let content = ""
            try {
              content = fs.readFileSync(path.join(shared, f), "utf-8")
            } catch {
              continue
            }
            const lines = content.split("\n")
            for (let i = 0; i < lines.length; i++) {
              if (lines[i].toLowerCase().includes(query)) {
                hits.push(`${f}:${i + 1}: ${lines.slice(Math.max(0, i - 1), i + 2).join(" | ")}`)
                break
              }
            }
          }
          return {
            content: hits.length ? hits.join("\n") : `nenhum resultado para "${input?.query}" em ${shared}`,
          }
        },
      })

      editor.add({
        name: "memory_write",
        description:
          "Escreve na memoria compartilhada deste projeto. Use no fim de uma sessao para deixar um resumo, ou para registrar feedback/decisao que sobrevive a sessao.",
        input: {
          type: "object",
          properties: {
            content: { type: "string", description: "conteudo markdown a gravar" },
            type: { type: "string", description: "session | feedback | project | reference | user (default: feedback)" },
          },
          required: ["content"],
        },
        execute: async (input) => {
          const type = String(input?.type || "feedback")
          const stamp = new Date().toISOString().replace(/[:.]/g, "-")
          const file = path.join(shared, `${type}-${stamp}.md`)
          const body = `---\ntype: ${type}\nproject: ${slug}\ncreated: ${new Date().toISOString()}\n---\n\n${input?.content ?? ""}\n`
          try {
            fs.mkdirSync(shared, { recursive: true })
            fs.writeFileSync(file, body)
            return { content: `gravado em ${file}` }
          } catch (err) {
            return { content: `falha ao gravar: ${err?.message ?? err}` }
          }
        },
      })
    })

    // 3. Captura de mutacoes de arquivo como observacao. So ferramentas que
    //    mudam estado; leituras (read/grep/glob) ficariam so como ruido.
    await ctx.tool.hook("execute.after", (event) => {
      const name = event?.tool ?? event?.name
      if (!INTERESTING_TOOLS.has(name)) return
      if (event.status !== "completed") return

      const input = event.input ?? {}
      const target = input.path ?? input.file ?? input.command ?? ""
      const when = new Date().toISOString()
      appendObservation(
        shared,
        `- ${when} \`${name}\`${target ? ` ${truncate(target, 200)}` : ""} (session ${event.sessionID ?? "?"})\n`,
      )
    })

    // 4. Fim de sessao / compactacao: escreve digest estruturado com consumo.
    const controller = new AbortController()
    void (async () => {
      try {
        for await (const ev of ctx.event.subscribe({ signal: controller.signal })) {
          if (ev.type === "session.step.ended") {
            const sid = ev.data?.sessionID ?? ev.sessionID
            if (!sid) continue
            const u = usageFor(sid)
            const t = ev.data?.tokens ?? {}
            u.input += t.input ?? 0
            u.output += t.output ?? 0
            u.reasoning += t.reasoning ?? 0
            u.cacheRead += t.cache?.read ?? 0
            u.cacheWrite += t.cache?.write ?? 0
            u.cost += ev.data?.cost ?? 0
            u.steps += 1
            continue
          }

          if (ev.type !== "session.idle" && ev.type !== "session.compacted") continue

          const sid = ev.data?.sessionID ?? ev.sessionID ?? ev.data?.id ?? "unknown"
          const u = usage.get(sid)
          const now = new Date().toISOString()

          let messages = []
          try {
            messages = await ctx.session.context({ sessionID: sid })
          } catch {
            messages = []
          }

          const prompts = messages.filter((m) => m.type === "user").map((m) => truncate(m.text, 300))
          const assistant = messages
            .filter((m) => m.type === "assistant")
            .flatMap((m) => (m.content ?? []).filter((c) => c.type === "text").map((c) => truncate(c.text, 500)))
          const toolsUsed = messages
            .filter((m) => m.type === "assistant")
            .flatMap((m) => (m.content ?? []).filter((c) => c.type === "tool").map((c) => c.name))

          const total = u ? u.input + u.output + u.reasoning : 0
          const front = [
            "---",
            "type: session",
            `project: ${slug}`,
            `session: ${sid}`,
            `event: ${ev.type}`,
            `ended: ${now}`,
            u ? `tokens: input=${u.input} output=${u.output} reasoning=${u.reasoning} cache_read=${u.cacheRead} cache_write=${u.cacheWrite} total=${total}` : "tokens: n/a",
            u ? `cost_usd: ${u.cost.toFixed(6)}` : "cost_usd: n/a",
            `steps: ${u?.steps ?? 0}`,
            "---",
            "",
          ].join("\n")

          const sections = [`# Sessão ${shortId(sid)}`, ""]
          if (prompts.length) sections.push("## Pedidos", ...prompts.map((p) => `- ${p}`), "")
          if (assistant.length) sections.push("## Assistente", ...assistant.slice(-10).map((a) => `- ${a}`), "")
          if (toolsUsed.length) {
            const counts = {}
            for (const t of toolsUsed) counts[t] = (counts[t] ?? 0) + 1
            sections.push(
              "## Ferramentas",
              ...Object.entries(counts).map(([t, c]) => `- ${t}: ${c}`),
              "",
            )
          }
          sections.push(`Evento: ${ev.type}`, "")

          const file = writeSessionDigest(shared, {
            ended: now,
            short: shortId(sid),
            body: `${front}${sections.join("\n")}\n`,
          })
          if (file) console.error(`[tabelhamem] resumo gravado: ${file}`)
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          console.error("[tabelhamem] stream de eventos terminou:", err?.message ?? err)
        }
      }
    })()

    console.error(`[tabelhamem] ativo para ${slug} -> ${shared}`)
    return () => controller.abort()
  },
}
