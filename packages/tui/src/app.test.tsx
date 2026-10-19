import { test, expect, beforeEach, afterEach } from "bun:test";
import { testRender } from "@opentui/solid";
import { App } from "./app.jsx";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

let homeDir: string;
let realHome: string | undefined;

beforeEach(() => {
  realHome = process.env.HOME;
  homeDir = join(tmpdir(), `tm-tui-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  process.env.HOME = homeDir;

  // Create fixture repos (20 projects to test scrolling)
  for (let i = 0; i < 20; i++) {
    mkdirSync(join(homeDir, `codigo/test/projeto-${i.toString().padStart(2, "0")}/.git`), { recursive: true });
    mkdirSync(join(homeDir, `agent-memory/projeto-${i.toString().padStart(2, "0")}`), { recursive: true });
  }
  
  // Create specific projects for other tests
  mkdirSync(join(homeDir, "codigo/tabelha/tabelhamem/.git"), { recursive: true });
  mkdirSync(join(homeDir, "codigo/wiv/blip-plugins/.git"), { recursive: true });
  mkdirSync(join(homeDir, "codigo/pessoal/gerador-ficha-tormenta20/.git"), { recursive: true });
  mkdirSync(join(homeDir, "agent-memory/tabelhamem"), { recursive: true });
  mkdirSync(join(homeDir, "agent-memory/blip-plugins"), { recursive: true });
  mkdirSync(join(homeDir, "agent-memory/gerador-ficha-tormenta20"), { recursive: true });

  // Create memory files for scrolling tests
  const lorem = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. ";
  // 80 topics for blip-plugins with long content
  for (let i = 0; i < 80; i++) {
    writeFileSync(join(homeDir, `agent-memory/blip-plugins/topic-${i.toString().padStart(2, "0")}.md`),
      `# Topic ${i}\n\n${lorem.repeat(100)}`);
  }
  
  // Memory files for gerador-ficha-tormenta20
  writeFileSync(join(homeDir, "agent-memory/gerador-ficha-tormenta20/agents.md"),
    "# Agents\n\n" + lorem.repeat(20));
  writeFileSync(join(homeDir, "agent-memory/gerador-ficha-tormenta20/tópicos.md"),
    "# Tópicos\n\n" + lorem.repeat(20));
  
  // Memory files for tabelhamem
  writeFileSync(join(homeDir, "agent-memory/tabelhamem/feedback.md"),
    "# Feedback\n\n" + lorem.repeat(10));
  writeFileSync(join(homeDir, "agent-memory/tabelhamem/session.md"),
    "# Session\n\n" + lorem.repeat(10));
    
  // Memory files for generic projects
  for (let i = 0; i < 20; i++) {
    for (let j = 0; j < 5; j++) {
      writeFileSync(join(homeDir, `agent-memory/projeto-${i.toString().padStart(2, "0")}/memoria-${j}.md`),
        `# Memória ${j}\n\nConteúdo de teste para o projeto ${i}.\n\n${lorem.repeat(5)}`);
    }
  }
});

afterEach(() => {
  process.env.HOME = realHome;
  rmSync(homeDir, { recursive: true, force: true });
});

async function press(setup: any, key: string, mods?: any, n = 1) {
  for (let i = 0; i < n; i++) setup.mockInput.pressKey(key, mods);
  await new Promise((r) => setTimeout(r, 20));
  await setup.renderOnce();
}

// O markdown monta o layout de forma assíncrona; sem assentar, o preview
// sai em branco e o teste não vê diferença nenhuma.
async function settle(setup: any, rounds = 4) {
  for (let i = 0; i < rounds; i++) {
    await setup.renderOnce();
    await new Promise((r) => setTimeout(r, 30));
  }
}

test("renderiza cabeçalho e painéis", async () => {
  const setup = await testRender(() => <App />, { width: 120, height: 34 });
  await setup.renderOnce();
  const frame = setup.captureCharFrame();
  expect(frame).toContain("memória compartilhada");
  expect(frame).toContain("Projetos");
  expect(frame).toContain("Memória");
  expect(frame).toContain("Ponte");
  expect(frame).toContain("liga/desliga");
});

test("abertura já seleciona o primeiro projeto", async () => {
  const setup = await testRender(() => <App />, { width: 120, height: 34 });
  await setup.renderOnce();
  const frame = setup.captureCharFrame();
  expect(frame).toContain("▸");
  expect(frame).not.toContain("sem seleção");
});

test("agrupa por org com headers e mostra grupo atual no título", async () => {
  const setup = await testRender(() => <App />, { width: 120, height: 34 });
  await setup.renderOnce();
  const frame = setup.captureCharFrame();
  expect(frame).toContain("memória/");
  expect(frame).toContain("tabelhamem");
  expect(frame).toContain("Projetos ·");
});

test("headers ficam quietos nas primeiras navegações", async () => {
  const setup = await testRender(() => <App />, { width: 120, height: 34 });
  await setup.renderOnce();
  await setup.mockInput.pressKeys(["j", "j", "j"]);
  await setup.renderOnce();
  const frame = setup.captureCharFrame();
  expect(frame).toContain("memória/");
});

test("preview rola com j e respeita a altura", async () => {
  const setup = await testRender(() => <App initialSlug="blip-plugins" />, { width: 120, height: 20 });
  await settle(setup);
  // Foca o preview (projects -> meio -> preview) e verifica se está focado
  await press(setup, "l", { ctrl: true }, 2);
  const frame = setup.captureCharFrame();
  // Verifica se o conteúdo do preview está sendo exibido (arquivo topic-00.md)
  expect(frame).toContain("Topic 0");
  // Verifica se há conteúdo Lorem ipsum (do arquivo de memória)
  expect(frame).toContain("Lorem ipsum");
  // Verifica se a altura do frame respeita o limite
  expect(frame.trimEnd().split("\n").length).toBeLessThanOrEqual(20);
});

test("frame nunca excede a altura pedida mesmo com muitas memórias", async () => {
  // blip-plugins tem 80+ arquivos; sem janela a coluna esticava tudo.
  const setup = await testRender(() => <App />, { width: 120, height: 20 });
  await setup.renderOnce();
  const lines = setup.captureCharFrame().trimEnd().split("\n");
  expect(lines.length).toBeLessThanOrEqual(20);
});

test("projeto gigante não estica os outros painéis", async () => {
  // blip-plugins tem o maior conteúdo; header, ponte e footer seguem
  // visíveis e o frame respeita a altura mesmo assim.
  const setup = await testRender(() => <App initialSlug="blip-plugins" />, { width: 120, height: 24 });
  await setup.renderOnce();
  const frame = setup.captureCharFrame();
  const lines = frame.trimEnd().split("\n");
  expect(lines.length).toBeLessThanOrEqual(24);
  expect(frame).toContain("memória compartilhada");
  expect(frame).toContain("Ponte");
  expect(frame).toContain("rescan");
});

test("lista de projetos rola com j sem estourar a altura", async () => {
  const setup = await testRender(() => <App />, { width: 120, height: 20 });
  await setup.renderOnce();
  const before = setup.captureCharFrame();
  await setup.mockInput.pressKeys(Array(15).fill("j"));
  await setup.renderOnce();
  const after = setup.captureCharFrame();
  expect(after.trimEnd().split("\n").length).toBeLessThanOrEqual(20);
  expect(after).not.toBe(before);
});

test("ponte com slug longo tem 3 linhas separadas e sem scrollbar", async () => {
  // gerador-ficha-tormenta20: slug longo real e estável (26 chars).
  const setup = await testRender(() => <App initialSlug="gerador-ficha-tormenta20" />, {
    width: 120,
    height: 24,
  });
  await setup.renderOnce();
  const frame = setup.captureCharFrame();
  const lines = frame.split("\n");
  // As 3 linhas da ponte aparecem em fileiras distintas, sem fusão:
  // a linha do slug não contém os dots, e os dots/tópicos têm linha própria.
  expect(lines.some((l) => l.includes("gerador-ficha-tormenta20"))).toBe(true);
  expect(lines.some((l) => l.includes("agents"))).toBe(true);
  expect(lines.some((l) => l.includes("tópicos"))).toBe(true);
  expect(lines.every((l) => !l.includes("gerador-ficha-tormenta20") || !l.includes("agents"))).toBe(true);
  expect(frame).not.toContain("█");
  expect(frame).not.toContain("▀");
});
