import { test, expect } from 'bun:test';
import { windowRows, type RowLike } from './rows.js';

function rows(spec: string): RowLike[] {
  return spec.split('').map((c) => ({ kind: c === 'o' ? 'org' : 'proj' }) as RowLike);
}

test('janela nunca termina num header órfão', () => {
  // Sem o ajuste, cursor 1 com janela 4 terminaria no header do índice 3.
  const all = rows('oppoppp');
  const w = windowRows(all, 1, 4);
  expect(w.list[w.list.length - 1].kind).toBe('proj');
  expect(1).toBeGreaterThanOrEqual(w.offset);
  expect(1).toBeLessThan(w.offset + w.list.length);
});

test('grupo pequeno mostra o header', () => {
  const all = rows('opppopp');
  const w = windowRows(all, 5, 4);
  expect(w.list.some((r) => r.kind === 'org')).toBe(true);
  expect(5).toBeGreaterThanOrEqual(w.offset);
  expect(5).toBeLessThan(w.offset + w.list.length);
});

test('cursor sempre visível', () => {
  const all = rows('opppopppopppp');
  for (let c = 0; c < all.length; c++) {
    const w = windowRows(all, c, 4);
    expect(c).toBeGreaterThanOrEqual(w.offset);
    expect(c).toBeLessThan(w.offset + w.list.length);
  }
});
