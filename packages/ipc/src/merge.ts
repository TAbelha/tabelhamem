import { existsSync, lstatSync, readdirSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, constants } from 'fs';
import { join, dirname, basename, sep } from 'path';

// Plano de junção de dirs de memória num destino. Nunca sobrescreve nem
// apaga: arquivo com mesmo nome e conteúdo diferente vira conflito.
export interface MergePlan {
  copies: { src: string; rel: string }[];
  identical: string[];
  indexMerges: { rel: string; addedLines: string[] }[];
  conflicts: { rel: string; sources: string[] }[];
}

const INDEX_FILE = 'MEMORY.md';

// Entrada do destino virtual: conteúdo atual (disco + o que já foi
// planejado) e de onde veio (pra listar no conflito).
interface VirtualFile {
  content: Buffer | null; // null = existe mas não é arquivo regular
  origin: string;
}

function readDst(dst: string, rel: string): VirtualFile | undefined {
  const p = join(dst, rel);
  try {
    const st = lstatSync(p);
    return { content: st.isFile() ? readFileSync(p) : null, origin: p };
  } catch {
    return undefined;
  }
}

function lines(buf: Buffer): string[] {
  return buf.toString('utf-8').split('\n');
}

// planMerge percorre as fontes (recursivo, por path relativo) e decide o
// destino de cada arquivo contra um dst virtual, então conflitos entre
// fontes também aparecem. dst ausente conta como vazio. Não escreve nada.
export function planMerge(sources: string[], dst: string): MergePlan {
  const plan: MergePlan = { copies: [], identical: [], indexMerges: [], conflicts: [] };
  const virtual = new Map<string, VirtualFile>();

  const lookup = (rel: string): VirtualFile | undefined => {
    if (virtual.has(rel)) return virtual.get(rel);
    const v = readDst(dst, rel);
    if (v) virtual.set(rel, v);
    return v;
  };

  const conflict = (rel: string, a: string, b: string) => {
    const c = plan.conflicts.find((x) => x.rel === rel);
    if (c) {
      for (const s of [a, b]) if (!c.sources.includes(s)) c.sources.push(s);
    } else {
      plan.conflicts.push({ rel, sources: [a, b] });
    }
  };

  // Um ancestral que é arquivo (no disco ou planejado) impede criar o dir.
  const blockedByFile = (rel: string): VirtualFile | undefined => {
    const parts = rel.split(sep);
    for (let i = 1; i < parts.length; i++) {
      const v = lookup(parts.slice(0, i).join(sep));
      if (v && v.content !== null) return v;
    }
    return undefined;
  };

  const visit = (root: string, relDir: string) => {
    const abs = join(root, relDir);
    for (const e of readdirSync(abs, { withFileTypes: true }).sort((x, y) => x.name.localeCompare(y.name))) {
      const rel = relDir ? join(relDir, e.name) : e.name;
      const srcPath = join(root, rel);
      if (e.isDirectory()) {
        const v = lookup(rel);
        if (v && v.content !== null) {
          conflict(rel, v.origin, srcPath);
          continue;
        }
        visit(root, rel);
        continue;
      }
      if (!e.isFile()) {
        // Symlink/socket/etc: tipo não suportado, nunca descarta em silêncio.
        conflict(rel, srcPath, srcPath);
        continue;
      }
      const blocker = blockedByFile(rel);
      if (blocker) {
        conflict(rel, blocker.origin, srcPath);
        continue;
      }
      const content = readFileSync(srcPath);
      const cur = lookup(rel);
      if (!cur) {
        plan.copies.push({ src: srcPath, rel });
        virtual.set(rel, { content, origin: srcPath });
      } else if (cur.content === null) {
        conflict(rel, cur.origin, srcPath);
      } else if (cur.content.equals(content)) {
        if (!plan.identical.includes(rel)) plan.identical.push(rel);
      } else if (basename(rel) === INDEX_FILE) {
        const have = new Set(lines(cur.content).map((l) => l.trim()).filter((l) => l !== ''));
        const added: string[] = [];
        for (const l of lines(content)) {
          const t = l.trim();
          if (t === '' || have.has(t)) continue;
          have.add(t);
          added.push(l.trimEnd());
        }
        if (added.length > 0) {
          const m = plan.indexMerges.find((x) => x.rel === rel);
          if (m) m.addedLines.push(...added);
          else plan.indexMerges.push({ rel, addedLines: added });
          virtual.set(rel, { content: Buffer.from(appendLines(cur.content.toString('utf-8'), added)), origin: cur.origin });
        } else if (!plan.identical.includes(rel)) {
          plan.identical.push(rel);
        }
      } else {
        conflict(rel, cur.origin, srcPath);
      }
    }
  };

  for (const s of sources) {
    if (existsSync(s)) visit(s, '');
  }
  return plan;
}

function appendLines(content: string, added: string[]): string {
  const sepNl = content.length > 0 && !content.endsWith('\n') ? '\n' : '';
  return content + sepNl + added.join('\n') + '\n';
}

// applyMerge executa o plano: copia (COPYFILE_EXCL, nunca sobrescreve nem
// move) e acrescenta linhas nos MEMORY.md. Recusa plano com conflito.
export function applyMerge(plan: MergePlan, dst: string): void {
  if (plan.conflicts.length > 0) {
    throw new Error(`merge com conflitos: ${plan.conflicts.map((c) => c.rel).join(', ')}`);
  }
  mkdirSync(dst, { recursive: true });
  for (const c of plan.copies) {
    const d = join(dst, c.rel);
    mkdirSync(dirname(d), { recursive: true });
    copyFileSync(c.src, d, constants.COPYFILE_EXCL);
  }
  for (const m of plan.indexMerges) {
    const d = join(dst, m.rel);
    writeFileSync(d, appendLines(readFileSync(d, 'utf-8'), m.addedLines));
  }
}
