#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
YoAi — SİSTEM SAĞLIĞI kontrolü -> E-POSTA.
launchd ile her gun 09:00 calisir (bilgisayar kapaliysa acilista bir kez telafi eder).

Projedeki TUM otomasyon parcalarinin calisip calismadigini tek bakista gosterir:
  1) Canli uygulama (prod /api/health)        6) Beyin verisi tazeligi (_learnings/_data)
  2) Ana sayfa erisimi                        7) GitHub yedek — ana repo senkron
  3) Supabase DB (omddq) erisimi              8) GitHub yedek — Beyin repo (yoai-brain)
  4) Vercel deploy + 9 cron tanimi            9) Kritik API anahtarlari (.env.local)
  5) Yerel Beyin job (com.yoai.brain.collect) 10) Saglik job'inin kendisi (self-report)

Her parca: ✓ (calisiyor) / ⚠️ (dikkat) / 🔴 (bozuk) + tek satir aciklama.
KONU SATIRI durumu yansitir: "🟢 ... her sey yolunda" / "🔴 ... N sorun var".

GUVENLIK: Token/sifre YERELDE kalir. .env.local yalniz okunur, degeri maile/buluta yazilmaz.
Repo'ya (yoai-brain) yalniz SIR-OLMAYAN durum ozeti (emoji + zaman) push edilir — bulut
sessizlik korumasi bunu okuyup "yerel saglik gunlerce uretilmedi mi" diye bakar.

Yapilandirma:
  ~/.yoai-saglik-automation/smtp_config.json -> {"sender","app_password","recipients":[...]}
Kullanim:
  python3 saglik_kontrol.py            # kontrolleri calistirir + mail atar
  python3 saglik_kontrol.py --dry-run  # mail ATMAZ; HTML'i dosyaya yazar + ozet basar
"""
import json, os, sys, ssl, smtplib, subprocess, urllib.request, urllib.error
from datetime import date, datetime, timezone
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.utils import formataddr

HOME = os.path.expanduser("~")
AUTO = os.path.join(HOME, ".yoai-saglik-automation")
LOG  = os.path.join(AUTO, "saglik.log")
DRY  = "--dry-run" in sys.argv

PROD = "https://yoai.yodijital.com"
BRAIN_JOB = "com.yoai.brain.collect"
BRAIN_LOG_DIR = os.path.join(HOME, ".yoai-brain-automation")

# Kritik env anahtarlari (mevcut & bos-degil kontrolu) — DEGERLERI okunmaz/yazilmaz
CRITICAL_ENV = [
    "APIFY_API_TOKEN", "SUPABASE_SERVICE_ROLE_KEY", "RESEND_API_KEY",
    "INNGEST_API_KEY", "VERCEL_API_TOKEN", "CRON_SECRET",
    "META_APP_SECRET", "GOOGLE_ADS_DEVELOPER_TOKEN",
]
VERCEL_CRONS = [
    "/api/yoai/daily-run", "/api/cron/yoalgoritma-scan", "/api/cron/strategy-metrics",
    "/api/cron/official-ads-refresh", "/api/cron/audiences-sync", "/api/cron/seo-article-run",
    "/api/cron/crm-lead-pull", "/api/cron/email-drip-process", "/api/cron/seo-brief-refresh",
]


def log(msg):
    try:
        with open(LOG, "a") as f:
            f.write(f"{datetime.now().isoformat(timespec='seconds')} {msg}\n")
    except Exception:
        pass


# ---------------------------------------------------------------- repo & env kesfi
def find_repo():
    """Ana YoAi repo'sunu bul: icinde _learnings + .git + package.json(name=YoAi)."""
    # 1) Bilinen mutlak yol (bu makine)
    known = os.path.join(HOME, "Desktop", "Onur Suay", "YO Dijital", "YOAİ", "YoAi_Project")
    if os.path.isdir(os.path.join(known, ".git")) and os.path.isdir(os.path.join(known, "_learnings")):
        return known
    # 2) Desktop altinda ara (yeni bilgisayar telafisi)
    base = os.path.join(HOME, "Desktop")
    for dp, dns, files in os.walk(base):
        dns[:] = [d for d in dns if d not in (".git", "node_modules", ".next", ".venv")]
        if "_learnings" in dns and ".git" in dns and "package.json" in files:
            try:
                if json.load(open(os.path.join(dp, "package.json"))).get("name") == "YoAi":
                    return dp
            except Exception:
                pass
    return None


def load_env(repo):
    """.env.local'i YEREL olarak oku (degerler maile/buluta gitmez)."""
    env = {}
    if not repo:
        return env
    p = os.path.join(repo, ".env.local")
    if not os.path.exists(p):
        return env
    try:
        for line in open(p, encoding="utf-8"):
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip().strip('"').strip("'")
    except Exception as e:
        log(f"env okuma HATA: {e}")
    return env


def http(url, headers=None, timeout=15):
    """(status_code, body_text) doner; hata olursa (None, 'sebep')."""
    req = urllib.request.Request(url, headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read(200000).decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, ""
    except Exception as e:
        return None, str(e)


def git(repo, *args, timeout=60):
    return subprocess.run(["git", "-C", repo, *args], capture_output=True, text=True, timeout=timeout)


def file_age_days(path):
    if not os.path.exists(path):
        return None
    mt = datetime.fromtimestamp(os.path.getmtime(path))
    return (datetime.now() - mt).days


# ---------------------------------------------------------------- KONTROLLER
# Her kontrol (icon, metin) doner. icon: "✓" | "⚠️" | "🔴"

def check_prod_health():
    code, body = http(f"{PROD}/api/health")
    if code == 200 and '"ok":true' in body.replace(" ", ""):
        return ("✓", "Canlı uygulama: çalışıyor (/api/health 200)")
    if code == 200:
        return ("⚠️", "Canlı uygulama: 200 döndü ama gövde beklenenden farklı")
    if code is None:
        return ("🔴", f"Canlı uygulama: ERİŞİLEMEDİ ({body[:60]})")
    return ("🔴", f"Canlı uygulama: HTTP {code} — sağlık endpoint'i bozuk")


def check_homepage():
    code, _ = http(PROD)
    if code == 200:
        return ("✓", "Ana sayfa: erişilebilir (200)")
    if code is None:
        return ("🔴", "Ana sayfa: ERİŞİLEMEDİ")
    return ("⚠️", f"Ana sayfa: HTTP {code}")


def check_supabase(env):
    url = env.get("NEXT_PUBLIC_SUPABASE_URL") or env.get("SUPABASE_URL")
    key = env.get("NEXT_PUBLIC_SUPABASE_ANON_KEY") or env.get("SUPABASE_ANON_KEY")
    if not url:
        return ("⚠️", "Supabase: URL .env.local'da yok — kontrol atlandı")
    headers = {"apikey": key} if key else {}
    code, _ = http(url.rstrip("/") + "/rest/v1/", headers=headers, timeout=15)
    # PostgREST kok: 200 (anahtarli) veya 401/404 bile = sunucu AYAKTA
    if code in (200, 401, 404):
        host = url.split("//")[-1].split(".")[0]
        return ("✓", f"Supabase DB ({host}): erişilebilir")
    if code is None:
        return ("🔴", "Supabase DB: ERİŞİLEMEDİ")
    return ("⚠️", f"Supabase DB: beklenmedik HTTP {code}")


def check_vercel(env, repo):
    token = env.get("VERCEL_API_TOKEN")
    pid = None
    org = None
    try:
        pj = json.load(open(os.path.join(repo, ".vercel", "project.json")))
        pid = pj.get("projectId")
        org = pj.get("orgId")
    except Exception:
        pass
    # project.json orgId guvenilir kaynak; .env.local VERCEL_TEAM_ID bozuk olabilir -> sonra dene
    team_candidates = [t for t in (org, env.get("VERCEL_TEAM_ID")) if t]
    # vercel.json'daki cron sayisi (her zaman okunur)
    cron_n = 0
    try:
        vj = json.load(open(os.path.join(repo, "vercel.json")))
        cron_n = len(vj.get("crons", []))
    except Exception:
        pass
    cron_note = f"{cron_n}/{len(VERCEL_CRONS)} cron tanımlı"
    if not (token and pid):
        return ("⚠️", f"Vercel: API token/projectId yok — deploy durumu okunamadı ({cron_note})")
    code, body = None, ""
    for team in (team_candidates or [None]):
        q = f"https://api.vercel.com/v6/deployments?projectId={pid}&limit=1&target=production"
        if team:
            q += f"&teamId={team}"
        code, body = http(q, headers={"Authorization": f"Bearer {token}"}, timeout=20)
        if code == 200:
            break
    if code != 200:
        return ("⚠️", f"Vercel: deploy durumu okunamadı (HTTP {code}) · {cron_note}")
    try:
        deps = json.loads(body).get("deployments", [])
        if not deps:
            return ("⚠️", f"Vercel: production deploy bulunamadı · {cron_note}")
        state = deps[0].get("state") or deps[0].get("readyState")
        if state == "READY":
            return ("✓", f"Vercel: son production deploy hazır (READY) · {cron_note}")
        if state in ("ERROR", "CANCELED"):
            return ("🔴", f"Vercel: son deploy {state} — cron'lar eski sürümde · {cron_note}")
        return ("⚠️", f"Vercel: son deploy durumu {state} · {cron_note}")
    except Exception as e:
        return ("⚠️", f"Vercel: yanıt çözümlenemedi ({e}) · {cron_note}")


def check_brain_job():
    """com.yoai.brain.collect launchd'de yuklu mu + son cikis kodu + log tazeligi."""
    try:
        r = subprocess.run(["launchctl", "list", BRAIN_JOB], capture_output=True, text=True, timeout=15)
    except Exception as e:
        return ("⚠️", f"Beyin job: launchctl okunamadı ({e})")
    if r.returncode != 0:
        return ("🔴", "Beyin job: launchd'de YÜKLÜ DEĞİL — günlük toplama çalışmıyor")
    exit_code = None
    for line in r.stdout.splitlines():
        if "LastExitStatus" in line:
            digits = "".join(c for c in line if c.isdigit() or c == "-")
            try:
                exit_code = int(digits)
            except Exception:
                pass
    out_age = file_age_days(os.path.join(BRAIN_LOG_DIR, "collect.out.log"))
    err_log = os.path.join(BRAIN_LOG_DIR, "collect.err.log")
    err_age = file_age_days(err_log)
    err_size = os.path.getsize(err_log) if os.path.exists(err_log) else 0
    # Hic calismamis (log yok)
    if out_age is None:
        return ("⚠️", "Beyin job: yüklü ama henüz hiç çalışmamış (collect.out.log yok)")
    if exit_code not in (0, None):
        return ("🔴", f"Beyin job: yüklü ama son çalışmada HATA (çıkış kodu {exit_code})")
    if err_age is not None and err_age <= 1 and err_size > 0:
        return ("⚠️", f"Beyin job: çalıştı ama dün hata günlüğü yazılmış (collect.err.log {err_size}B)")
    if out_age > 2:
        return ("⚠️", f"Beyin job: yüklü ama {out_age} gün çalışmadı (bilgisayar kapalı kalmış olabilir)")
    return ("✓", f"Beyin job: yüklü ve çalışıyor (son çıkış 0, log {out_age} gün önce)")


def check_brain_data(repo):
    p = os.path.join(repo, "_learnings", "_data", "latest.json")
    age = file_age_days(p)
    if age is None:
        return ("⚠️", "Beyin verisi: latest.json yok — toplama henüz üretmemiş")
    if age <= 2:
        return ("✓", f"Beyin verisi: taze ({age} gün önce güncellendi)")
    if age <= 8:
        return ("⚠️", f"Beyin verisi: {age} gün eski")
    return ("⚠️", f"Beyin verisi: {age} gün eski (uzun süredir güncellenmemiş)")


def check_git_sync(repo, label, remote_branch=None):
    if not (repo and os.path.isdir(os.path.join(repo, ".git"))):
        return ("⚠️", f"GitHub {label}: repo bulunamadı")
    try:
        git(repo, "fetch", "-q", "origin", timeout=45)
        branch = git(repo, "rev-parse", "--abbrev-ref", "HEAD").stdout.strip()
        loc = git(repo, "rev-parse", "HEAD").stdout.strip()
        # upstream varsa onu, yoksa origin/<branch> ya da origin/main
        up = git(repo, "rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}").stdout.strip()
        ref = up if up else (remote_branch or f"origin/{branch}")
        rem = git(repo, "rev-parse", ref).stdout.strip()
        last = git(repo, "log", "-1", "--format=%cd", "--date=short").stdout.strip()
        if loc and rem and loc == rem:
            return ("✓", f"GitHub {label}: güncel/push'lu ({branch}, son {last})")
        # Local origin'in onunde mi (push edilmemis commit) yoksa geride mi
        cnt = git(repo, "rev-list", "--count", f"{ref}..HEAD").stdout.strip()
        if cnt and cnt != "0":
            return ("⚠️", f"GitHub {label}: {cnt} commit push EDİLMEMİŞ ({branch})")
        return ("⚠️", f"GitHub {label}: senkron değil ({branch})")
    except Exception as e:
        return ("⚠️", f"GitHub {label}: kontrol hatası ({str(e)[:40]})")


def check_env_keys(env):
    if not env:
        return ("⚠️", "API anahtarları: .env.local okunamadı")
    missing = [k for k in CRITICAL_ENV if not env.get(k)]
    if not missing:
        return ("✓", f"API anahtarları: {len(CRITICAL_ENV)} kritik anahtar mevcut")
    return ("🔴", f"API anahtarları: EKSİK → {', '.join(missing)}")


def check_self():
    return ("✓", f"Sağlık job: bugün çalıştı ({date.today().isoformat()})")


# ---------------------------------------------------------------- mail
def send_mail(html, subject):
    cfg_path = os.path.join(AUTO, "smtp_config.json")
    if not os.path.exists(cfg_path):
        log("smtp_config.json YOK — mail atilamadi"); print("HATA: smtp_config.json yok."); return False
    cfg = json.load(open(cfg_path))
    sender, pw, rcpts = cfg.get("sender"), cfg.get("app_password"), cfg.get("recipients", [])
    if not (sender and pw and rcpts):
        log("smtp_config eksik"); print("HATA: smtp_config eksik."); return False
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = formataddr(("YoAi Sağlık", sender))
    msg["To"] = ", ".join(rcpts)
    msg.attach(MIMEText(html, "html", "utf-8"))
    ctx = ssl.create_default_context()
    with smtplib.SMTP_SSL("smtp.gmail.com", 465, context=ctx) as s:
        s.login(sender, pw.replace(" ", ""))
        s.sendmail(sender, rcpts, msg.as_string())
    log(f"mail GONDERILDI -> {', '.join(rcpts)} | {subject}")
    return True


def build_html(rows, reds, warns):
    ok = reds == 0 and warns == 0
    if reds:
        bg, head = "#b00020", f"🔴 DİKKAT — {reds} sorun" + (f", {warns} uyarı" if warns else "") + " var"
    elif warns:
        bg, head = "#8a6d00", f"🟡 {warns} uyarı — kontrol edilmeli"
    else:
        bg, head = "#0f7b3f", "🟢 SİSTEM SAĞLIĞI — Her şey çalışıyor"
    items = "".join(
        f"<li style='margin:4px 0;line-height:1.5'>{ic}&nbsp; {tx}</li>" for ic, tx in rows
    )
    now = datetime.now().strftime("%d.%m.%Y %H:%M")
    return f"""<!doctype html><html><body style="margin:0;background:#f1f1f4;padding:24px 0;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1d1d28">
  <div style="max-width:640px;margin:0 auto;padding:0 16px">
    <div style="margin-bottom:16px">
      <div style="font-size:22px;font-weight:800;letter-spacing:-0.03em">YoAi · Sistem Sağlığı</div>
      <div style="font-size:13px;color:#666;margin-top:3px">{now} · günlük otomatik kontrol</div>
    </div>
    <div style="border-radius:14px;overflow:hidden;border:1px solid #e6e6ea">
      <div style="padding:13px 16px;background:{bg};color:#fff;font-weight:700;font-size:15px">{head}</div>
      <div style="padding:12px 18px;background:#fff">
        <ul style="margin:0;padding-left:20px;font-size:13.5px;color:#222">{items}</ul>
      </div>
    </div>
    <div style="font-size:12px;color:#999;margin-top:12px;line-height:1.6">
      Otomatik günlük sağlık kontrolü (her gün 09:00). ✓ çalışıyor · ⚠️ dikkat · 🔴 bozuk.
      Token/şifreler yerelde tutulur, bu maile yazılmaz. Sorun varsa ilgili parçayı kontrol et.
    </div>
  </div>
</body></html>"""


# ---------------------------------------------------------------- bulut sessizlik korumasi icin durum push'u
def push_status(repo, rows, reds, warns):
    """SIR-OLMAYAN durum ozetini yoai-brain repo'suna yaz + push.
    Bulut haftalik ajan bunun tazeligine bakip 'bilgisayar gunlerce kapali mi' anlar."""
    brain = os.path.join(repo, "_learnings")
    if not os.path.isdir(os.path.join(brain, ".git")):
        return
    ddir = os.path.join(brain, "_data")
    os.makedirs(ddir, exist_ok=True)
    payload = {
        "generated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "generated_local": datetime.now().isoformat(timespec="seconds"),
        "host": os.uname().nodename if hasattr(os, "uname") else "?",
        "ozet": {"sorun": reds, "uyari": warns, "ok": len(rows) - reds - warns, "toplam": len(rows)},
        "durum": "🟢" if (reds == 0 and warns == 0) else ("🔴" if reds else "🟡"),
        "satirlar": [{"durum": ic, "mesaj": tx} for ic, tx in rows],
        "_TALIMAT": "Bu dosya YEREL saglik job'i tarafindan yazildi (sir icermez). Bulut ajani: "
                    "'generated' 8+ gun eskiyse bilgisayar uzun suredir kapali demektir -> "
                    "onursuay@hotmail.com'a 'yerel saglik uretilmiyor' uyari taslagi birak.",
    }
    p = os.path.join(ddir, "saglik_latest.json")
    json.dump(payload, open(p, "w"), ensure_ascii=False, indent=2)
    try:
        git(brain, "add", "_data/saglik_latest.json")
        r = git(brain, "commit", "-m", f"saglik: durum ozeti {date.today().isoformat()} (otomatik)")
        if r.returncode == 0:
            pr = git(brain, "push", timeout=90)
            log(f"durum push: {'OK' if pr.returncode == 0 else pr.stderr[:120]}")
        else:
            log("durum push: degisiklik yok")
    except Exception as e:
        log(f"durum push HATA: {e}")


# ---------------------------------------------------------------- main
def main():
    repo = find_repo()
    env = load_env(repo)
    if not repo:
        log("repo bulunamadi — sinirli kontrol")

    rows = []
    rows.append(check_prod_health())
    rows.append(check_homepage())
    rows.append(check_supabase(env))
    if repo:
        rows.append(check_vercel(env, repo))
    rows.append(check_brain_job())
    if repo:
        rows.append(check_brain_data(repo))
        rows.append(check_git_sync(repo, "ana repo", "origin/main"))
        rows.append(check_git_sync(os.path.join(repo, "_learnings"), "Beyin repo (yoai-brain)", "origin/main"))
    rows.append(check_env_keys(env))
    rows.append(check_self())

    reds = sum(1 for ic, _ in rows if ic == "🔴")
    warns = sum(1 for ic, _ in rows if ic == "⚠️")

    if reds:
        subject = f"🔴 YoAi Sağlık — {reds} sorun var"
    elif warns:
        subject = f"🟡 YoAi Sağlık — {warns} uyarı"
    else:
        subject = "🟢 YoAi Sağlık — her şey yolunda"

    html = build_html(rows, reds, warns)

    if DRY:
        out = os.path.join(AUTO, "son_saglik_onizleme.html")
        open(out, "w").write(html)
        print(f"[DRY-RUN] {subject}")
        for ic, tx in rows:
            print(f"  {ic} {tx}")
        print(f"Önizleme: {out}")
        log(f"dry-run | {subject}")
        return

    try:
        send_mail(html, subject)
        print(f"Mail gönderildi: {subject}")
    except Exception as e:
        log(f"mail HATA: {e}"); print(f"Mail HATASI: {e}")

    # Bulut sessizlik korumasi: sir-olmayan durumu repo'ya push (maili asla bozmaz)
    if repo:
        try:
            push_status(repo, rows, reds, warns)
        except Exception as e:
            log(f"durum push HATA: {e}")


if __name__ == "__main__":
    main()
