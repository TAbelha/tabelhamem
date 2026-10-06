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
