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
echo "(o opencode recarrega plugins locais sozinho; sem restart)"
