import { test, expect } from "bun:test";
import { testRender } from "@opentui/solid";
import { App } from "./app.jsx";

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
  const setup = await testRender(() => <App />, { width: 120, height: 20 });
  await setup.renderOnce();
  const before = setup.captureCharFrame();
  // Foca o preview (projects -> meio -> preview) e rola pra baixo.
  setup.mockInput.pressKey("l", { ctrl: true });
  setup.mockInput.pressKey("l", { ctrl: true });
  await setup.renderOnce();
  for (let i = 0; i < 10; i++) setup.mockInput.pressKey("j");
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
  for (let i = 0; i < 15; i++) setup.mockInput.pressKey("j");
  await setup.renderOnce();
  const after = setup.captureCharFrame();
  expect(after.trimEnd().split("\n").length).toBeLessThanOrEqual(20);
  expect(after).not.toBe(before);
});
