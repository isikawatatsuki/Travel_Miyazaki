/**
 * 住所や施設名から座標を引く。OpenStreetMap の Nominatim を使う。
 *
 * Nominatim の利用規約に沿うため、ここを必ず通す：
 *   - アプリを名乗る User-Agent（ブラウザからは設定できない禁止ヘッダなのでサーバー側必須）
 *   - 上流への問い合わせは全体で 1秒に1回まで
 *   - 結果をキャッシュし、同じ問い合わせを繰り返さない
 *   - 一括処理をしない（呼び出し側は1件ずつ順に投げる）
 */

const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "TabilogTravelPlanner/1.0 (https://travel-miyazaki.pages.dev)";
const MIN_UPSTREAM_GAP_MS = 1_100;
const CACHE_TTL_MS = 180 * 24 * 60 * 60 * 1000;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_BLOCK_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 120;
const FETCH_TIMEOUT_MS = 6_000;
const MAX_QUERY_LENGTH = 200;

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
};

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: jsonHeaders });

async function hashValue(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function ensureTables(env) {
  await env.DB.batch([
    env.DB.prepare("CREATE TABLE IF NOT EXISTS geocode_cache (query_hash TEXT PRIMARY KEY, lat REAL, lng REAL, display_name TEXT, created_at INTEGER NOT NULL)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS geocode_throttle (id INTEGER PRIMARY KEY, last_called_at INTEGER NOT NULL)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS join_rate_limits (identity_hash TEXT PRIMARY KEY, attempts INTEGER NOT NULL, window_started_at INTEGER NOT NULL, blocked_until INTEGER NOT NULL DEFAULT 0)"),
  ]);
}

async function enforceCallerLimit(env, request) {
  const address = request.headers.get("cf-connecting-ip") || "unknown";
  const identity = await hashValue(`geocode:${address}`);
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

/**
 * 上流への間隔を空ける。全体で 1秒1回という規約を守るための番人。
 * ponytail: 直近呼び出し時刻をD1の1行で持つ素朴な方式。同時アクセスが増えたら
 * Durable Object などの本物の直列化へ置き換える。
 */
async function waitForUpstreamSlot(env) {
  const now = Date.now();
  const row = await env.DB.prepare("SELECT last_called_at FROM geocode_throttle WHERE id = 1").first();
  const elapsed = now - Number(row?.last_called_at || 0);
  if (elapsed < MIN_UPSTREAM_GAP_MS) {
    const wait = MIN_UPSTREAM_GAP_MS - elapsed;
    if (wait > 2_000) return false;
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
  await env.DB.prepare("INSERT OR REPLACE INTO geocode_throttle (id, last_called_at) VALUES (1, ?)").bind(Date.now()).run();
  return true;
}

export async function onRequest({ request, env }) {
  if (request.method !== "POST") return json({ error: "Not found" }, 404);
  if (!env.DB) return json({ error: "住所検索の保存先が未設定です。" }, 500);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "送信内容を読み込めませんでした。" }, 400);
  }

  const query = String(body?.query || "").trim().slice(0, MAX_QUERY_LENGTH);
  if (!query) return json({ error: "調べる場所が空です。" }, 400);

  await ensureTables(env);

  const key = await hashValue(query.toLowerCase());
  const cached = await env.DB.prepare("SELECT lat, lng, display_name, created_at FROM geocode_cache WHERE query_hash = ?").bind(key).first();
  if (cached && Date.now() - Number(cached.created_at) < CACHE_TTL_MS) {
    if (cached.lat === null) return json({ error: "その場所は見つかりませんでした。", cached: true }, 404);
    return json({ lat: cached.lat, lng: cached.lng, displayName: cached.display_name, cached: true });
  }

  if (!(await enforceCallerLimit(env, request))) {
    return json({ error: "検索が多すぎます。しばらく待ってからお試しください。" }, 429);
  }
  if (!(await waitForUpstreamSlot(env))) {
    return json({ error: "住所検索が混み合っています。少し待ってからお試しください。" }, 503);
  }

  const url = new URL(NOMINATIM);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("accept-language", "ja");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let results;
  try {
    const response = await fetch(url.toString(), { headers: { "user-agent": USER_AGENT, accept: "application/json" }, signal: controller.signal });
    if (!response.ok) throw new Error("upstream");
    results = await response.json();
  } catch {
    return json({ error: "住所検索に接続できませんでした。時間をおいてお試しください。" }, 502);
  } finally {
    clearTimeout(timer);
  }

  const hit = Array.isArray(results) ? results[0] : null;
  const lat = hit ? Number(hit.lat) : NaN;
  const lng = hit ? Number(hit.lon) : NaN;
  const found = Number.isFinite(lat) && Number.isFinite(lng);

  // 見つからなかったことも覚えておく。同じ空振りを上流へ何度も投げないため。
  await env.DB.prepare("INSERT OR REPLACE INTO geocode_cache (query_hash, lat, lng, display_name, created_at) VALUES (?, ?, ?, ?, ?)")
    .bind(key, found ? lat : null, found ? lng : null, found ? String(hit.display_name || "") : null, Date.now()).run();

  if (!found) return json({ error: "その場所は見つかりませんでした。" }, 404);
  return json({ lat, lng, displayName: String(hit.display_name || ""), attribution: "© OpenStreetMap contributors" });
}
