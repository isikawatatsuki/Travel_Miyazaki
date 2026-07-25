/**
 * Googleマップの短縮URLを展開する。
 *
 * スマホのGoogleマップアプリで共有すると maps.app.goo.gl の短縮URLになり、
 * 座標も地名も入っていない。展開先には両方入っているが、ブラウザからは
 * CORS で追えないのでここで1ホップだけ追う。
 *
 * 任意のURLを取りに行けるとSSRFになるため、短縮リンクのホストだけに絞る。
 */

const ALLOWED_HOSTS = new Set(["maps.app.goo.gl", "goo.gl", "maps.google.com"]);
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_BLOCK_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 60;
const FETCH_TIMEOUT_MS = 5_000;

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: jsonHeaders });
}

async function hashValue(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** 展開してよいURLか。プロトコルとホストの両方を見る。 */
function allowedShortLink(value) {
  let url;
  try {
    url = new URL(String(value));
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (!ALLOWED_HOSTS.has(url.hostname)) return null;
  return url.toString();
}

/** 展開先がGoogleマップであることを確かめる。別ドメインへ飛ばされたら捨てる。 */
function isGoogleMaps(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && /(^|\.)google\.[a-z.]+$/.test(url.hostname) && url.pathname.startsWith("/maps");
  } catch {
    return false;
  }
}

async function enforceRateLimit(env, request) {
  if (!env.DB) return;
  const address = request.headers.get("cf-connecting-ip") || "unknown";
  const identity = await hashValue(`resolve:${address}`);
  const now = Date.now();
  const current = await env.DB.prepare("SELECT attempts, window_started_at, blocked_until FROM join_rate_limits WHERE identity_hash = ?").bind(identity).first();
  if (current && Number(current.blocked_until) > now) throw new Error("rate-limited");
  if (!current || now - Number(current.window_started_at) > RATE_WINDOW_MS) {
    await env.DB.prepare("INSERT OR REPLACE INTO join_rate_limits (identity_hash, attempts, window_started_at, blocked_until) VALUES (?, 1, ?, 0)").bind(identity, now).run();
    return;
  }
  const attempts = Number(current.attempts || 0) + 1;
  const blockedUntil = attempts > MAX_ATTEMPTS ? now + RATE_BLOCK_MS : 0;
  await env.DB.prepare("UPDATE join_rate_limits SET attempts = ?, blocked_until = ? WHERE identity_hash = ?").bind(attempts, blockedUntil, identity).run();
  if (blockedUntil) throw new Error("rate-limited");
}

export async function onRequest({ request, env }) {
  if (request.method !== "POST") return json({ error: "Not found" }, 404);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "送信内容を読み込めませんでした。" }, 400);
  }

  const target = allowedShortLink(body?.url);
  if (!target) return json({ error: "短縮URLとして扱えないアドレスです。" }, 400);

  try {
    await enforceRateLimit(env, request);
  } catch {
    return json({ error: "変換が多すぎます。しばらく待ってからお試しください。" }, 429);
  }

  // リダイレクトは自分で1回だけ追う。自動追跡だと本文まで取りに行ってしまい、
  // 転送量も増えるうえ、飛び先の検査ができない。
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(target, { redirect: "manual", signal: controller.signal, headers: { "user-agent": "Mozilla/5.0" } });
  } catch {
    return json({ error: "短縮URLを展開できませんでした。時間をおいてお試しください。" }, 502);
  } finally {
    clearTimeout(timer);
  }

  const location = response.headers.get("location") || "";
  if (!location || !isGoogleMaps(location)) {
    return json({ error: "展開先がGoogleマップではありませんでした。" }, 422);
  }

  return json({ url: location });
}
