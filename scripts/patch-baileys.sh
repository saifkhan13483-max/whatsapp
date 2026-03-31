#!/bin/sh
# Patches for @whiskeysockets/baileys 7.0.0-rc.9
# Fix 1: passive:true bug causes WhatsApp to reject pairing code
# Fix 2: lidDbMigrated causes server-side rejection
# Fix 3: await noise.finishInit() causes timing issues

BAILEYS="./node_modules/.pnpm/@whiskeysockets+baileys@7.0.0-rc.9/node_modules/@whiskeysockets/baileys/lib"

if [ ! -d "$BAILEYS" ]; then
  echo "[patch-baileys] Baileys 7.0.0-rc.9 not found, skipping patches."
  exit 0
fi

sed -i 's/passive: true,/passive: false,/' "$BAILEYS/Utils/validate-connection.js"
sed -i '/lidDbMigrated: false/d' "$BAILEYS/Utils/validate-connection.js"
sed -i 's/await noise\.finishInit();/noise.finishInit();/' "$BAILEYS/Socket/socket.js"

echo "[patch-baileys] Baileys patches applied successfully."
