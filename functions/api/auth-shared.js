const SESSION_TTL_MS = 90 * 24 * 60 * 60 * 1000;

export async function ensureAuthTables(env) {
  await env.DB.batch([
    env.DB.prepare("CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, provider TEXT NOT NULL, provider_sub TEXT NOT NULL, email TEXT, display_name TEXT, created_at INTEGER NOT NULL, UNIQUE (provider, provider_sub))"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS group_members (group_id TEXT NOT NULL, user_id TEXT NOT NULL, role TEXT NOT NULL, joined_at INTEGER NOT NULL, PRIMARY KEY (group_id, user_id))"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(user_id)"),
  ]);
}

export async function hashValue(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function makeToken(prefix, byteLength = 24) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return `${prefix}_${[...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

export function parseCookies(request) {
  return Object.fromEntries((request.headers.get("cookie") || "").split(";").map((part) => part.trim()).filter(Boolean).map((part) => {
    const separator = part.indexOf("=");
    return separator < 0 ? [part, ""] : [part.slice(0, separator), decodeURIComponent(part.slice(separator + 1))];
  }));
}

export function cookie(name, value, maxAge) {
  return `${name}=${encodeURIComponent(value)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}

export async function resolveSession(env, request) {
  const token = parseCookies(request).session || "";
  if (!token) return null;
  const tokenHash = await hashValue(token);
  const session = await env.DB.prepare("SELECT sessions.user_id, sessions.expires_at, users.email, users.display_name FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.token_hash = ?").bind(tokenHash).first();
  if (!session || Number(session.expires_at) <= Date.now()) {
    if (session) await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(tokenHash).run();
    return null;
  }
  return { id: String(session.user_id), email: String(session.email || ""), displayName: String(session.display_name || "") };
}

export function decodeAndValidateIdToken(idToken, clientId, now = Date.now()) {
  const parts = String(idToken || "").split(".");
  if (parts.length !== 3) throw new Error("Googleの認証情報を確認できませんでした。");
  const encoded = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  const padded = encoded.padEnd(Math.ceil(encoded.length / 4) * 4, "=");
  let payload;
  try { payload = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(padded), (character) => character.charCodeAt(0)))); }
  catch { throw new Error("Googleの認証情報を読み込めませんでした。"); }
  if (payload.aud !== clientId || !["accounts.google.com", "https://accounts.google.com"].includes(payload.iss) || Number(payload.exp) * 1000 <= now || !payload.sub) {
    throw new Error("Googleの認証情報が無効です。");
  }
  return payload;
}

export async function createSession(env, userId) {
  const token = makeToken("session", 32);
  const now = Date.now();
  await env.DB.prepare("INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)").bind(await hashValue(token), userId, now, now + SESSION_TTL_MS).run();
  return token;
}
