#!/usr/bin/env bash
# Patches @whiskeysockets/baileys to disable passive mode so pairing-code
# companion-device auth works correctly (passive:false is required for
# requestPairingCode to succeed).
set -euo pipefail

BAILEYS_DIR="$(dirname "$0")/../node_modules/@whiskeysockets/baileys"

if [ ! -d "$BAILEYS_DIR" ]; then
  echo "[patch-baileys] Baileys not found at $BAILEYS_DIR — skipping patch"
  exit 0
fi

# Patch lib/Socket/socket.js — set passive: false
SOCKET_FILE="$BAILEYS_DIR/lib/Socket/socket.js"
if [ -f "$SOCKET_FILE" ]; then
  if grep -q "passive:true\|passive: true" "$SOCKET_FILE"; then
    sed -i 's/passive:\s*true/passive: false/g' "$SOCKET_FILE"
    echo "[patch-baileys] Patched passive:true -> passive:false in socket.js"
  else
    echo "[patch-baileys] passive:true not found in socket.js — already patched or not needed"
  fi
fi

# Patch lib/Socket/socket.js — ensure markOnlineOnConnect stays false
if [ -f "$SOCKET_FILE" ]; then
  if grep -q "markOnlineOnConnect:true\|markOnlineOnConnect: true" "$SOCKET_FILE"; then
    sed -i 's/markOnlineOnConnect:\s*true/markOnlineOnConnect: false/g' "$SOCKET_FILE"
    echo "[patch-baileys] Patched markOnlineOnConnect:true -> false in socket.js"
  fi
fi

echo "[patch-baileys] Patch complete"
