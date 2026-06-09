#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────
# YoAi Beyin — Push-öncesi Sır Taraması
#
# yoai-brain repo'suna (varsayılan: _learnings) push edilecek dosyaları,
# git'in KENDİ ignore mantığıyla (NFC/NFD-safe; string karşılaştırması YOK)
# seçip bilinen sır desenlerine karşı tarar. Eşleşme varsa exit 1 → PUSH İPTAL.
#
# Kullanım: scripts/brain/secret-scan.sh [REPO_DIR]
# ──────────────────────────────────────────────────────────
set -uo pipefail

DIR="${1:-_learnings}"

if ! git -C "$DIR" rev-parse --git-dir >/dev/null 2>&1; then
  echo "[secret-scan] HATA: '$DIR' bir git repo değil." >&2
  exit 2
fi

cd "$DIR" || exit 2

# git'in commit edeceği dosya listesi: izlenen (--cached) + izlenmeyen-ama-ignore-değil (--others),
# .gitignore'a saygılı (--exclude-standard). Hariç tutma kararını GIT verir, biz string karşılaştırmayız.
files=()
while IFS= read -r -d '' f; do
  files+=("$f")
done < <(git ls-files -z --cached --others --exclude-standard)

if [ ${#files[@]} -eq 0 ]; then
  echo "[secret-scan] Taranacak (commit edilebilir) dosya yok."
  exit 0
fi

# Bilinen sır desenleri (YoAi gerçek formatları)
patterns=(
  'EAA[A-Za-z0-9]{40,}'                       # Meta access token
  'GOCSPX-[A-Za-z0-9_-]{20,}'                 # Google OAuth client secret
  '1//[A-Za-z0-9_-]{40,}'                     # Google OAuth refresh token
  'AIza[A-Za-z0-9_-]{30,}'                    # Google API key
  'sk-ant-[A-Za-z0-9_-]{20,}'                 # Anthropic API key
  'sk-proj-[A-Za-z0-9_-]{20,}'                # OpenAI (proj) key
  'sk-[A-Za-z0-9]{32,}'                       # OpenAI legacy key
  'apify_api_[A-Za-z0-9]{20,}'               # Apify token
  'fc-[A-Za-z0-9]{20,}'                       # Firecrawl key
  'eyJ[A-Za-z0-9_=-]{10,}\.[A-Za-z0-9_=-]{10,}'  # JWT / Supabase anon/service key
  '-----BEGIN [A-Z ]*PRIVATE'                 # PEM private key
  '[0-9a-f]{32}'                              # Genel 32-hex (Meta app secret vb.)
)

found=0
for pat in "${patterns[@]}"; do
  if matches=$(grep -nIE "$pat" -- "${files[@]}" 2>/dev/null); then
    if [ -n "$matches" ]; then
      echo "[secret-scan] ⚠️  POTANSİYEL SIR deseni: $pat" >&2
      echo "$matches" | sed 's/^/    /' >&2
      found=1
    fi
  fi
done

if [ "$found" -ne 0 ]; then
  echo "[secret-scan] ❌ Sır deseni bulundu — PUSH İPTAL. Temizleyip tekrar deneyin." >&2
  exit 1
fi

echo "[secret-scan] ✅ Temiz — bilinen sır deseni bulunamadı (${#files[@]} dosya tarandı)."
exit 0
