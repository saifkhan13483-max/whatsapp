#!/bin/sh
# Patches for @whiskeysockets/baileys 7.0.0-rc.9
# Fix 1: passive:true bug causes WhatsApp to reject pairing code
# Fix 2: lidDbMigrated causes server-side rejection
#
# NOTE: Do NOT patch noise.finishInit() — finishInit is an async function that
# derives the Noise protocol encryption keys via localHKDF. Removing the await
# leaves encKey/decKey at their pre-handshake values, so WhatsApp immediately
# closes the connection when it cannot decrypt the first message.

BAILEYS="./node_modules/.pnpm/@whiskeysockets+baileys@7.0.0-rc.9/node_modules/@whiskeysockets/baileys/lib"

if [ ! -d "$BAILEYS" ]; then
  echo "[patch-baileys] Baileys 7.0.0-rc.9 not found, skipping patches."
  exit 0
fi

sed -i 's/passive: true,/passive: false,/' "$BAILEYS/Utils/validate-connection.js"
sed -i '/lidDbMigrated: false/d' "$BAILEYS/Utils/validate-connection.js"

echo "[patch-baileys] Baileys patches applied successfully."
