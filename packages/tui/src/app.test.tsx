import { test, expect } from "bun:test";
import { testRender } from "@opentui/solid";
import { App } from "./app.jsx";

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

test("agrupa por org com headers e mostra grupo atual no título", async () => {
  const setup = await testRender(() => <App />, { width: 120, height: 34 });
  await setup.renderOnce();
  const frame = setup.captureCharFrame();
  expect(frame).toContain("ea/");
  expect(frame).toContain("tabelhamem");
  expect(frame).toContain("Projetos ·");
});

test("preview rola com j e respeita a altura", async () => {
  const setup = await testRender(() => <App initialSlug="blip-plugins" />, { width: 120, height: 20 });
  await settle(setup);
  // Foca o preview (projects -> meio -> preview) e rola pra baixo.
  await press(setup, "l", { ctrl: true }, 2);
  const before = setup.captureCharFrame();
  await setup.mockInput.pressKeys(Array(10).fill("j"));
  await setup.renderOnce();
  const after = setup.captureCharFrame();
  expect(after.trimEnd().split("\n").length).toBeLessThanOrEqual(20);
  expect(after).not.toBe(before);
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
  const setup = await testRender(() => <App initialSlug="bs-1028-contatos-retencao-enterprise" />, {
    width: 120,
    height: 24,
  });
  await setup.renderOnce();
  const frame = setup.captureCharFrame();
  const lines = frame.split("\n");
  // As 3 linhas da ponte aparecem em fileiras distintas, sem fusão.
  expect(lines.some((l) => l.includes("contatos-retencao-enterprise"))).toBe(true);
  expect(lines.some((l) => l.includes("○ agents"))).toBe(true);
  expect(lines.some((l) => l.includes("tópicos"))).toBe(true);
  expect(frame).not.toContain("█");
  expect(frame).not.toContain("▀");
});
