// Janela deslizante sobre linhas de grupo/projeto: nunca termina num header
// órfão e, quando o grupo do cursor cabe na janela, começa no header dele.
export interface RowLike {
  kind: 'org' | 'proj';
}

export function windowRows<T extends RowLike>(
  all: T[],
  cursor: number,
  size: number,
): { list: T[]; offset: number } {
  if (all.length <= size) return { list: all, offset: 0 };
  const maxStart = all.length - size;

  let h = Math.max(0, Math.min(cursor, all.length - 1));
  while (h > 0 && all[h].kind !== 'org') h--;
  let end = h + 1;
  while (end < all.length && all[end].kind !== 'org') end++;

  let start: number;
  if (end - h <= size) {
    start = Math.min(h, maxStart);
  } else {
    start = Math.max(0, Math.min(cursor - Math.floor(size / 2), maxStart));
  }
  // Desloca até a janela não terminar num header órfão.
  for (let i = 0; i < size && start + size < all.length && all[start + size - 1].kind === 'org'; i++) {
    start = start > 0 ? start - 1 : start + 1;
  }
  return { list: all.slice(start, start + size), offset: start };
}
