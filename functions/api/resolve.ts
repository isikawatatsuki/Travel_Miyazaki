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

/**
 * 展開先がGoogleマップであることを確かめる。別ドメインへ飛ばされたら捨てる。
 * パスは限定しない。共有の仕方によっては maps.google.com/?q=… のように
 * /maps を含まない形へ飛ぶため、ここを厳しくすると正当なリンクを弾く。
 */
function isGoogleMaps(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    const host = url.hostname;
    return /(^|\.)google\.[a-z.]+$/.test(host) || host === "maps.google.com";
  } catch {
    return false;
  }
}

/**
 * レート制限。上限に達したときだけ false を返す。
 * DBの不調をレート制限として扱うと「多すぎます」と誤報し、原因も隠れるので、
 * ここでは真偽だけを返し、例外は呼び出し側で握らない。
 */
async function withinRateLimit(env, request) {
  if (!env.DB) return true;
  // 他のAPIが作る前に呼ばれることがある。ここでも用意しておく。
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS join_rate_limits (identity_hash TEXT PRIMARY KEY, attempts INTEGER NOT NULL, window_started_at INTEGER NOT NULL, blocked_until INTEGER NOT NULL DEFAULT 0)").run();
  const address = request.headers.get("cf-connecting-ip") || "unknown";
  const identity = await hashValue(`resolve:${address}`);
  const now = Date.now();
  const current = await env.DB.prepare("SELECT attempts, window_started_at, blocked_until FROM join_rate_limits WHERE identity_hash = ?").bind(identity).first();
  if (current && Number(current.blocked_until) > now) return false;
  if (!current || now - Number(current.window_started_at) > RATE_WINDOW_MS) {
    await env.DB.prepare("INSERT OR REPLACE INTO join_rate_limits (identity_hash, attempts, window_started_at, blocked_until) VALUES (?, 1, ?, 0)").bind(identity, now).run();
    return true;
  }
  const attempts = Number(current.attempts || 0) + 1;
  const blockedUntil = attempts > MAX_ATTEMPTS ? now + RATE_BLOCK_MS : 0;
  await env.DB.prepare("UPDATE join_rate_limits SET attempts = ?, blocked_until = ? WHERE identity_hash = ?").bind(attempts, blockedUntil, identity).run();
  return !blockedUntil;
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

  if (!(await withinRateLimit(env, request))) {
    return json({ error: "変換が多すぎます。しばらく待ってからお試しください。" }, 429);
  }

  // リダイレクトは自分で追う。自動追跡だと本文まで取りに行ってしまい、
  // 飛び先を1つずつ検査できない。座標付きURLは数ホップ先に現れることがある。
  let current = target;
  let landed = "";
  for (let hop = 0; hop < 4; hop += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let response;
    try {
      response = await fetch(current, { redirect: "manual", signal: controller.signal, headers: { "user-agent": "Mozilla/5.0" } });
    } catch {
      return json({ error: "短縮URLを展開できませんでした。時間をおいてお試しください。" }, 502);
    } finally {
      clearTimeout(timer);
    }
    const next = response.headers.get("location") || "";
    if (!next) break;
    if (!isGoogleMaps(next)) return json({ error: "展開先がGoogleマップではありませんでした。" }, 422);
    landed = next;
    // 座標が入った時点で追跡を止める。これ以上は同じ情報しか出てこない。
    if (/[@]-?\d+\.\d+,-?\d+\.\d+|!3d-?\d+\.\d+/.test(next)) break;
    current = next;
  }

  if (!landed) return json({ error: "展開先が見つかりませんでした。" }, 422);
  const location = landed;

  return json({ url: location });
}
