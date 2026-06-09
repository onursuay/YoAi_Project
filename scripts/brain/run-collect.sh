#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────
# YoAi Beyin — Yerel toplama + güvenli push sarmalayıcı (launchd buradan çağrılır)
#
# 1) collect-outcomes.mjs → _learnings/_data/latest.json (anonim agrega)
# 2) secret-scan.sh → sır deseni varsa DUR
# 3) _learnings'de değişiklik varsa commit + push (idempotent)
#
# Token .env.local'da YERELDE kalır; bu script onu çıktıya/repoya yazmaz.
# ──────────────────────────────────────────────────────────
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BRAIN="$ROOT/_learnings"

cd "$ROOT" || exit 2

echo "[run-collect] $(date '+%Y-%m-%d %H:%M:%S') — başladı (root: $ROOT)"

# 1) Veri topla (read-only)
node "$SCRIPT_DIR/collect-outcomes.mjs" || { echo "[run-collect] collect başarısız — push yok." >&2; exit 1; }

# 2) Sır taraması (push edilecek dosyalar)
bash "$SCRIPT_DIR/secret-scan.sh" "$BRAIN" || { echo "[run-collect] secret-scan FAIL — push İPTAL." >&2; exit 1; }

# 3) Değişiklik varsa commit + push
if ! git -C "$BRAIN" rev-parse --git-dir >/dev/null 2>&1; then
  echo "[run-collect] '_learnings' henüz git repo değil — push atlandı (önce kurulum)."
  exit 0
fi

git -C "$BRAIN" add -A
if git -C "$BRAIN" diff --cached --quiet; then
  echo "[run-collect] Değişiklik yok — push atlandı (idempotent)."
  exit 0
fi

git -C "$BRAIN" commit -m "data: yerel outcome agregaları güncellendi ($(date '+%Y-%m-%d %H:%M'))" >/dev/null
if git -C "$BRAIN" push 2>/dev/null; then
  echo "[run-collect] ✅ push tamam."
else
  echo "[run-collect] ⚠️  push başarısız (remote/ağ?). Commit yerelde duruyor." >&2
fi
exit 0
