import { ensureAuthTables, resolveSession } from "../auth-shared.js";

const MAX_BODY_BYTES = 4_000_000;
const TOKEN_TTL_MS = 180 * 24 * 60 * 60 * 1000;
const JOIN_CODE_TTL_MS = 90 * 24 * 60 * 60 * 1000;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_BLOCK_MS = 15 * 60 * 1000;
const MAX_JOIN_ATTEMPTS = 8;

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
};

class ApiError extends Error {
  declare status: number;
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), { status, headers: { ...jsonHeaders, ...extraHeaders } });
}

function makeToken(prefix) {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const value = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${prefix}_${value}`;
}

function makeId(prefix) {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const value = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${prefix}_${value}`;
}

function makeJoinCode() {
  const range = 900_000;
  const ceiling = 0x1_0000_0000 - (0x1_0000_0000 % range);
  const values = new Uint32Array(1);
  do crypto.getRandomValues(values); while (values[0] >= ceiling);
  return String(100_000 + (values[0] % range));
}

async function hashValue(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function readBody(request) {
  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > MAX_BODY_BYTES) throw new ApiError("送信データが大きすぎます。写真や添付ファイルを減らしてください。", 413);
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) throw new ApiError("送信データが大きすぎます。写真や添付ファイルを減らしてください。", 413);
  try {
    const parsed = JSON.parse(text || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    throw new ApiError("送信内容を読み込めませんでした。", 400);
  }
}

function safeUrl(value) {
  try {
    const url = new URL(String(value));
    return ["https:", "http:"].includes(url.protocol) ? url.toString().slice(0, 2_000) : "";
  } catch {
    return "";
  }
}

function sanitizeValue(value, key = "", depth = 0) {
  if (depth > 8 || value === null) return value === null ? null : undefined;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    if (key === "dataUrl") return /^data:image\/(jpeg|png|webp);base64,/i.test(value) ? value.slice(0, 800_000) : "";
    if (key === "attachmentData") return /^data:(application\/pdf|image\/(jpeg|png|webp)|text\/plain)(;charset=[^;,]+)?;base64,/i.test(value) ? value.slice(0, 400_000) : "";
    if (/url$/i.test(key)) return value ? safeUrl(value) : "";
    return value.slice(0, key === "text" || key === "memo" ? 4_000 : 2_000);
  }
  if (Array.isArray(value)) return value.slice(0, key === "items" ? 200 : 100).map((item) => sanitizeValue(item, "", depth + 1)).filter((item) => item !== undefined);
  if (typeof value === "object") {
    const result = {};
    for (const [childKey, childValue] of Object.entries(value).slice(0, 100)) {
      if (["__proto__", "prototype", "constructor"].includes(childKey)) continue;
      const sanitized = sanitizeValue(childValue, childKey, depth + 1);
      if (sanitized !== undefined) result[childKey] = sanitized;
    }
    return result;
  }
  return undefined;
}

function sanitizeState(value) {
  const state = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const sanitized = sanitizeValue({
    tripSettings: state.tripSettings || null,
    schedule: state.schedule || null,
    adjust: state.adjust || null,
    settlement: state.settlement || null,
    checklist: state.checklist || null,
    notes: state.notes || null,
    reservations: state.reservations || null,
    album: state.album || null,
    history: state.history || null,
  });
  if (sanitized?.reservations?.items && Array.isArray(sanitized.reservations.items)) {
    sanitized.reservations.items = sanitized.reservations.items.map((item) => ({
      ...item,
      reference: "",
      attachmentData: "",
      attachmentName: "",
    }));
  }
  const serialized = JSON.stringify(sanitized);
  if (new TextEncoder().encode(serialized).byteLength > MAX_BODY_BYTES) throw new ApiError("共有データが大きすぎます。写真や添付ファイルを減らしてください。", 413);
  return serialized;
}

async function ensureSecurityTables(env) {
  await env.DB.batch([
    env.DB.prepare("CREATE TABLE IF NOT EXISTS group_security (group_id TEXT PRIMARY KEY, join_expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS group_tokens (token_hash TEXT PRIMARY KEY, group_id TEXT NOT NULL, permission TEXT NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_group_tokens_group_id ON group_tokens(group_id)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS join_rate_limits (identity_hash TEXT PRIMARY KEY, attempts INTEGER NOT NULL, window_started_at INTEGER NOT NULL, blocked_until INTEGER NOT NULL DEFAULT 0)"),
  ]);
  await ensureAuthTables(env);
}

async function issueDeviceTokens(env, groupId) {
  const readToken = makeToken("read");
  const editToken = makeToken("edit");
  const now = Date.now();
  const expiresAt = now + TOKEN_TTL_MS;
  await env.DB.batch([
    env.DB.prepare("INSERT INTO group_tokens (token_hash, group_id, permission, created_at, expires_at) VALUES (?, ?, 'read', ?, ?)").bind(await hashValue(readToken), groupId, now, expiresAt),
    env.DB.prepare("INSERT INTO group_tokens (token_hash, group_id, permission, created_at, expires_at) VALUES (?, ?, 'edit', ?, ?)").bind(await hashValue(editToken), groupId, now, expiresAt),
  ]);
  return { readToken, editToken };
}

async function verifyDeviceToken(env, group, token, requiredPermission) {
  if (!token) return false;
  const tokenHash = await hashValue(token);
  const member = await env.DB.prepare("SELECT permission, expires_at FROM group_tokens WHERE token_hash = ? AND group_id = ?").bind(tokenHash, group.id).first();
  if (member && Number(member.expires_at) > Date.now()) return requiredPermission === "read" || member.permission === "edit";

  const stored = String(group.edit_token || "");
  const legacyMatches = stored.startsWith("sha256:") ? stored === `sha256:${tokenHash}` : stored === token;
  if (!legacyMatches) return false;
  await env.DB.batch([
    env.DB.prepare("UPDATE groups SET edit_token = ? WHERE id = ?").bind(`sha256:${tokenHash}`, group.id),
    env.DB.prepare("INSERT OR REPLACE INTO group_tokens (token_hash, group_id, permission, created_at, expires_at) VALUES (?, ?, 'edit', ?, ?)").bind(tokenHash, group.id, Date.now(), Date.now() + TOKEN_TTL_MS),
  ]);
  return true;
}

export async function resolveAccess(env, request, group, requiredPermission) {
  const user = await resolveSession(env, request);
  if (user) {
    const membership = await env.DB.prepare("SELECT role FROM group_members WHERE group_id = ? AND user_id = ?").bind(group.id, user.id).first();
    if (membership && (requiredPermission === "read" || ["owner", "editor"].includes(String(membership.role)))) return true;
  }
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  return verifyDeviceToken(env, group, token, requiredPermission);
}

async function rateLimitIdentity(request, action) {
  const address = request.headers.get("cf-connecting-ip") || "unknown";
  return hashValue(`${action}:${address}`);
}

async function enforceRateLimit(env, request, action, maximum) {
  const identity = await rateLimitIdentity(request, action);
  const now = Date.now();
  const current = await env.DB.prepare("SELECT attempts, window_started_at, blocked_until FROM join_rate_limits WHERE identity_hash = ?").bind(identity).first();
  if (current && Number(current.blocked_until) > now) throw new ApiError("操作が多すぎます。15分ほど待ってからお試しください。", 429);
  if (!current || now - Number(current.window_started_at) > RATE_WINDOW_MS) {
    await env.DB.prepare("INSERT OR REPLACE INTO join_rate_limits (identity_hash, attempts, window_started_at, blocked_until) VALUES (?, 1, ?, 0)").bind(identity, now).run();
    return;
  }
  const attempts = Number(current?.attempts || 0) + 1;
  const blockedUntil = attempts > maximum ? now + RATE_BLOCK_MS : 0;
  await env.DB.prepare("UPDATE join_rate_limits SET attempts = ?, blocked_until = ? WHERE identity_hash = ?").bind(attempts, blockedUntil, identity).run();
  if (blockedUntil) throw new ApiError("操作が多すぎます。15分ほど待ってからお試しください。", 429);
}

async function createGroup(env, request) {
  await enforceRateLimit(env, request, "create", 5);
  const body = await readBody(request);
  const id = makeId("grp");
  const name = String(body.name || "旅行グループ").trim().slice(0, 40) || "旅行グループ";
  const stateJson = sanitizeState(body.state);
  const ownerToken = makeToken("owner");
  const ownerHash = await hashValue(ownerToken);
  let joinCode = makeJoinCode();
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const existing = await env.DB.prepare("SELECT id FROM groups WHERE join_code = ?").bind(joinCode).first();
    if (!existing) break;
    joinCode = makeJoinCode();
  }

  const now = Date.now();
  const user = await resolveSession(env, request);
  const statements = [
    env.DB.prepare("INSERT INTO groups (id, name, join_code, edit_token, state_json) VALUES (?, ?, ?, ?, ?)").bind(id, name, joinCode, `sha256:${ownerHash}`, stateJson),
    env.DB.prepare("INSERT INTO group_security (group_id, join_expires_at, created_at) VALUES (?, ?, ?)").bind(id, now + JOIN_CODE_TTL_MS, now),
    env.DB.prepare("INSERT INTO group_tokens (token_hash, group_id, permission, created_at, expires_at) VALUES (?, ?, 'edit', ?, ?)").bind(ownerHash, id, now, now + TOKEN_TTL_MS),
  ];
  if (user) statements.push(env.DB.prepare("INSERT INTO group_members (group_id, user_id, role, joined_at) VALUES (?, ?, 'owner', ?)").bind(id, user.id, now));
  await env.DB.batch(statements);
  const readToken = makeToken("read");
  await env.DB.prepare("INSERT INTO group_tokens (token_hash, group_id, permission, created_at, expires_at) VALUES (?, ?, 'read', ?, ?)").bind(await hashValue(readToken), id, now, now + TOKEN_TTL_MS).run();
  const created = await env.DB.prepare("SELECT updated_at FROM groups WHERE id = ?").bind(id).first();
  return json({ group: { id, name, joinCode, readToken, editToken: ownerToken, updatedAt: created?.updated_at, state: JSON.parse(stateJson) } }, 201);
}

async function joinGroup(env, request) {
  await enforceRateLimit(env, request, "join", MAX_JOIN_ATTEMPTS);
  const body = await readBody(request);
  const joinCode = String(body.joinCode || "").replace(/\D/g, "").slice(0, 6);
  if (joinCode.length !== 6) throw new ApiError("参加コードは6桁で入力してください。", 400);
  const group = await env.DB.prepare("SELECT id, name, join_code, state_json, updated_at FROM groups WHERE join_code = ?").bind(joinCode).first();
  if (!group) throw new ApiError("グループが見つかりませんでした。", 404);
  const security = await env.DB.prepare("SELECT join_expires_at FROM group_security WHERE group_id = ?").bind(group.id).first();
  if (security && Number(security.join_expires_at) < Date.now()) throw new ApiError("参加コードの有効期限が切れています。", 410);
  const tokens = await issueDeviceTokens(env, group.id);
  return json({ group: { id: group.id, name: group.name, joinCode: group.join_code, ...tokens, updatedAt: group.updated_at, state: JSON.parse(group.state_json) } });
}

async function readGroup(env, request, id) {
  const group = await env.DB.prepare("SELECT id, name, join_code, edit_token, state_json, updated_at FROM groups WHERE id = ?").bind(id).first();
  if (!group || !(await resolveAccess(env, request, group, "read"))) throw new ApiError("グループを読み込めませんでした。", 404);
  return json({ group: { id: group.id, name: group.name, joinCode: group.join_code, updatedAt: group.updated_at, state: JSON.parse(group.state_json) } });
}

async function updateGroup(env, request, id) {
  const body = await readBody(request);
  const stateJson = sanitizeState(body.state);
  const group = await env.DB.prepare("SELECT id, edit_token, updated_at FROM groups WHERE id = ?").bind(id).first();
  if (!group || !(await resolveAccess(env, request, group, "edit"))) throw new ApiError("グループを更新できませんでした。", 403);
  if (body.expectedUpdatedAt && body.expectedUpdatedAt !== group.updated_at) throw new ApiError("別の端末で更新されています。最新状態を読み込んでから、もう一度変更してください。", 409);
  await env.DB.prepare("UPDATE groups SET state_json = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?").bind(stateJson, id).run();
  const updated = await env.DB.prepare("SELECT updated_at FROM groups WHERE id = ?").bind(id).first();
  return json({ ok: true, group: { id, updatedAt: updated?.updated_at } });
}

async function listGroups(env, request) {
  const user = await resolveSession(env, request);
  if (!user) throw new ApiError("ログインしてください。", 401);
  const result = await env.DB.prepare("SELECT groups.id, groups.name, groups.join_code, groups.state_json, groups.updated_at, group_members.role FROM group_members JOIN groups ON groups.id = group_members.group_id WHERE group_members.user_id = ? ORDER BY groups.updated_at DESC").bind(user.id).all();
  return json({ groups: (result.results || []).map((group) => ({ id: group.id, name: group.name, joinCode: group.join_code, updatedAt: group.updated_at, role: group.role, state: JSON.parse(String(group.state_json)) })) });
}

export async function claimGroup(env, request, id) {
  const user = await resolveSession(env, request);
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!user || !token) throw new ApiError("ログインと端末の編集権限が必要です。", 401);
  const group = await env.DB.prepare("SELECT id, edit_token FROM groups WHERE id = ?").bind(id).first();
  if (!group || !(await verifyDeviceToken(env, group, token, "edit"))) throw new ApiError("グループを引き継げませんでした。", 403);
  const current = await env.DB.prepare("SELECT role FROM group_members WHERE group_id = ? AND user_id = ?").bind(id, user.id).first();
  const owner = await env.DB.prepare("SELECT user_id FROM group_members WHERE group_id = ? AND role = 'owner' LIMIT 1").bind(id).first();
  const role = current?.role || (owner ? "editor" : "owner");
  await env.DB.prepare("INSERT OR REPLACE INTO group_members (group_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)").bind(id, user.id, role, Date.now()).run();
  return json({ ok: true, role });
}

export async function onRequest({ request, env, params }) {
  try {
    if (!env.DB) throw new ApiError("グループ共有の保存先が未設定です。", 500);
    await ensureSecurityTables(env);
    const method = request.method.toUpperCase();
    const parts = String(params.path || "").split("/").filter(Boolean);
    if (method === "GET" && parts.length === 0) return listGroups(env, request);
    if (method === "POST" && parts.length === 0) return createGroup(env, request);
    if (method === "POST" && parts[0] === "join") return joinGroup(env, request);
    if (method === "GET" && parts.length === 1) return readGroup(env, request, parts[0]);
    if (method === "PUT" && parts.length === 1) return updateGroup(env, request, parts[0]);
    if (method === "POST" && parts.length === 2 && parts[1] === "claim") return claimGroup(env, request, parts[0]);
    return json({ error: "Not found" }, 404);
  } catch (error) {
    if (error instanceof ApiError) {
      const headers = error.status === 429 ? { "retry-after": "900" } : {};
      return json({ error: error.message }, error.status, headers);
    }
    return json({ error: "サーバーで処理できませんでした。" }, 500);
  }
}
