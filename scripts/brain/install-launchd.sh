#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────
# YoAi Beyin — launchd job kurulumu (macOS)
#
# Yerel toplayıcıyı (run-collect.sh) her gün 08:00'de çalıştırır.
# Mevcut Sponsorlu launchd pattern'iyle aynı tarzda.
#
# Kullanım: bash scripts/brain/install-launchd.sh   (kurar/yeniler)
#           bash scripts/brain/install-launchd.sh --uninstall
# ──────────────────────────────────────────────────────────
set -uo pipefail

LABEL="com.yoai.brain.collect"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
RUNNER="$SCRIPT_DIR/run-collect.sh"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOGDIR="$HOME/.yoai-brain-automation"

if [ "${1:-}" = "--uninstall" ]; then
  launchctl unload "$PLIST" 2>/dev/null || true
  rm -f "$PLIST"
  echo "[install-launchd] $LABEL kaldırıldı."
  exit 0
fi

NODE_BIN="$(command -v node || true)"
if [ -z "$NODE_BIN" ]; then
  echo "[install-launchd] HATA: node PATH'te bulunamadı." >&2
  exit 1
fi
NODE_DIR="$(dirname "$NODE_BIN")"

mkdir -p "$LOGDIR"
mkdir -p "$HOME/Library/LaunchAgents"

cat > "$PLIST" <<PLISTEOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>$LABEL</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>$RUNNER</string>
    </array>
    <key>WorkingDirectory</key>
    <string>$ROOT</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>$NODE_DIR:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
    </dict>
    <key>StartCalendarInterval</key>
    <dict>
        <key>Hour</key>
        <integer>8</integer>
        <key>Minute</key>
        <integer>0</integer>
    </dict>
    <key>RunAtLoad</key>
    <false/>
    <key>StandardOutPath</key>
    <string>$LOGDIR/collect.out.log</string>
    <key>StandardErrorPath</key>
    <string>$LOGDIR/collect.err.log</string>
</dict>
</plist>
PLISTEOF

launchctl unload "$PLIST" 2>/dev/null || true
launchctl load "$PLIST"

echo "[install-launchd] ✅ $LABEL kuruldu (her gün 08:00)."
echo "[install-launchd]    plist: $PLIST"
echo "[install-launchd]    log:   $LOGDIR/collect.{out,err}.log"
echo "[install-launchd]    node:  $NODE_BIN"
echo "[install-launchd] Test: bash $RUNNER"
