import { SyntaxStyle } from '@opentui/core';

// Paleta sóbria (tokyo-night-ish) pra TUI não parecer terminal cru.
export const C = {
  primary: '#7dcfff',
  muted: '#565f89',
  text: '#c0caf5',
  success: '#9ece6a',
  warning: '#e0af68',
  error: '#f7768e',
};

let cached: SyntaxStyle | null = null;

// Estilo do preview markdown. SyntaxStyle.create() entrega o default do
// OpenTUI; fromStyles permite afinar por token depois.
export function markdownStyle(): SyntaxStyle {
  if (!cached) cached = SyntaxStyle.create();
  return cached;
}
