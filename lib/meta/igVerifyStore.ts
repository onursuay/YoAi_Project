/**
 * Supabase-backed store for IG verify: result cache, per-user rate-limit cooldown,
 * and inflight lock to prevent concurrent Meta calls.
 *
 * All operations are non-fatal (fail-open if Supabase is unavailable).
 * Tokens are NEVER stored or logged.
 *
 * ── Required SQL (run once in Supabase SQL editor) ────────────────────────────
 *
 * -- 1) Result cache (10-min TTL)
 * create table if not exists ig_verify_cache (
 *   user_id    text        not null,
 *   page_id    text        not null,
 *   instagram_user_id text,
 *   username   text,
 *   source_edge text,
 *   expires_at timestamptz not null,
 *   updated_at timestamptz not null default now(),
 *   primary key (user_id, page_id)
 * );
 *
 * -- 2) Per-user rate-limit cooldown
 * create table if not exists ig_verify_cooldown (
 *   user_id    text        not null primary key,
 *   until_at   timestamptz not null,
 *   reason     text,
 *   updated_at timestamptz not null default now()
 * );
 *
 * -- 3) Inflight lock (prevents concurrent calls for same user+page)
 * create table if not exists ig_verify_lock (
 *   user_id    text        not null,
 *   page_id    text        not null,
 *   until_at   timestamptz not null,
 *   updated_at timestamptz not null default now(),
 *   primary key (user_id, page_id)
 * );
 * ─────────────────────────────────────────────────────────────────────────────
 */

function getConfig(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return { url: url.replace(/\/$/, ''), key }
}

function headers(key: string, extra?: Record<string, string>) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    ...extra,
  }
}

// ── Cache ─────────────────────────────────────────────────────────────────────

export interface IgVerifyCacheRecord {
  instagram_user_id: string | null
  username: string | null
  source_edge: string | null
}

export async function getCache(
  userId: string,
  pageId: string
): Promise<{ hit: true; record: IgVerifyCacheRecord } | { hit: false }> {
  const cfg = getConfig()
  if (!cfg) return { hit: false }
  try {
    const now = new Date().toISOString()
    const res = await fetch(
      `${cfg.url}/rest/v1/ig_verify_cache` +
        `?user_id=eq.${encodeURIComponent(userId)}` +
        `&page_id=eq.${encodeURIComponent(pageId)}` +
        `&expires_at=gt.${encodeURIComponent(now)}` +
        `&select=instagram_user_id,username,source_edge&limit=1`,
      { headers: headers(cfg.key) }
    )
    if (!res.ok) return { hit: false }
    const rows = (await res.json()) as IgVerifyCacheRecord[]
    if (!Array.isArray(rows) || rows.length === 0) return { hit: false }
    return { hit: true, record: rows[0] }
  } catch {
    return { hit: false }
  }
}

export async function setCache(
  userId: string,
  pageId: string,
  record: IgVerifyCacheRecord,
  ttlSec = 600
): Promise<void> {
  const cfg = getConfig()
  if (!cfg) return
  try {
    const expiresAt = new Date(Date.now() + ttlSec * 1000).toISOString()
    await fetch(`${cfg.url}/rest/v1/ig_verify_cache`, {
      method: 'POST',
      headers: headers(cfg.key, { Prefer: 'resolution=merge-duplicates' }),
      body: JSON.stringify({
        user_id: userId,
        page_id: pageId,
        instagram_user_id: record.instagram_user_id,
        username: record.username,
        source_edge: record.source_edge,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      }),
    })
  } catch {
    // non-fatal
  }
}

// ── Cooldown ──────────────────────────────────────────────────────────────────

export async function getCooldown(
  userId: string
): Promise<{ active: true; retryAfterSec: number } | { active: false }> {
  const cfg = getConfig()
  if (!cfg) return { active: false }
  try {
    const now = new Date().toISOString()
    const res = await fetch(
      `${cfg.url}/rest/v1/ig_verify_cooldown` +
        `?user_id=eq.${encodeURIComponent(userId)}` +
        `&until_at=gt.${encodeURIComponent(now)}` +
        `&select=until_at&limit=1`,
      { headers: headers(cfg.key) }
    )
    if (!res.ok) return { active: false }
    const rows = (await res.json()) as { until_at: string }[]
    if (!Array.isArray(rows) || rows.length === 0) return { active: false }
    const remaining = Math.max(1, Math.ceil((new Date(rows[0].until_at).getTime() - Date.now()) / 1000))
    return { active: true, retryAfterSec: remaining }
  } catch {
    return { active: false }
  }
}

export async function setCooldown(
  userId: string,
  retryAfterSec: number,
  reason?: string
): Promise<void> {
  const cfg = getConfig()
  if (!cfg) return
  try {
    const untilAt = new Date(Date.now() + retryAfterSec * 1000).toISOString()
    await fetch(`${cfg.url}/rest/v1/ig_verify_cooldown`, {
      method: 'POST',
      headers: headers(cfg.key, { Prefer: 'resolution=merge-duplicates' }),
      body: JSON.stringify({
        user_id: userId,
        until_at: untilAt,
        reason: reason ?? null,
        updated_at: new Date().toISOString(),
      }),
    })
  } catch {
    // non-fatal
  }
}

// ── Inflight Lock ─────────────────────────────────────────────────────────────

export async function acquireLock(
  userId: string,
  pageId: string,
  lockSec = 20
): Promise<{ acquired: true } | { acquired: false; retryAfterSec: number }> {
  const cfg = getConfig()
  if (!cfg) return { acquired: true } // fail-open when Supabase unavailable
  try {
    const now = new Date().toISOString()
    // Check for existing active lock
    const checkRes = await fetch(
      `${cfg.url}/rest/v1/ig_verify_lock` +
        `?user_id=eq.${encodeURIComponent(userId)}` +
        `&page_id=eq.${encodeURIComponent(pageId)}` +
        `&until_at=gt.${encodeURIComponent(now)}` +
        `&select=until_at&limit=1`,
      { headers: headers(cfg.key) }
    )
    if (checkRes.ok) {
      const rows = (await checkRes.json()) as { until_at: string }[]
      if (Array.isArray(rows) && rows.length > 0) {
        const remaining = Math.max(1, Math.ceil((new Date(rows[0].until_at).getTime() - Date.now()) / 1000))
        return { acquired: false, retryAfterSec: remaining }
      }
    }
    // Write lock
    const untilAt = new Date(Date.now() + lockSec * 1000).toISOString()
    await fetch(`${cfg.url}/rest/v1/ig_verify_lock`, {
      method: 'POST',
      headers: headers(cfg.key, { Prefer: 'resolution=merge-duplicates' }),
      body: JSON.stringify({
        user_id: userId,
        page_id: pageId,
        until_at: untilAt,
        updated_at: new Date().toISOString(),
      }),
    })
    return { acquired: true }
  } catch {
    return { acquired: true } // fail-open if Supabase is unreachable
  }
}

export async function releaseLock(userId: string, pageId: string): Promise<void> {
  const cfg = getConfig()
  if (!cfg) return
  try {
    await fetch(
      `${cfg.url}/rest/v1/ig_verify_lock` +
        `?user_id=eq.${encodeURIComponent(userId)}` +
        `&page_id=eq.${encodeURIComponent(pageId)}`,
      {
        method: 'DELETE',
        headers: headers(cfg.key),
      }
    )
  } catch {
    // non-fatal
  }
}
