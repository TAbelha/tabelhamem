#!/usr/bin/env bash
# Instala o plugin do tabelhamem no OpenCode global.
# Fonte de verdade: packages/plugin/src/opencode.js -> ~/.config/opencode/plugins/tabelhamem.js
set -euo pipefail

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/src/opencode.js"
DEST_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/opencode/plugins"
DEST="$DEST_DIR/tabelhamem.js"

if [ ! -f "$SRC" ]; then
  echo "fonte nao encontrada: $SRC" >&2
  exit 1
fi

mkdir -p "$DEST_DIR"
cp "$SRC" "$DEST"
echo "plugin instalado em $DEST"

if command -v opencode >/dev/null 2>&1; then
  echo "reiniciando servico do opencode..."
  opencode service restart >/dev/null 2>&1 || true
  echo "status:"
  opencode service status 2>&1 | head -5 || true
fi
