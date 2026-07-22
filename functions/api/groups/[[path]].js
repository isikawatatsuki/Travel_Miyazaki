const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: jsonHeaders,
  });
}

function makeId(prefix) {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const value = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${prefix}_${value}`;
}

function makeJoinCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function readBody(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function sanitizeState(value) {
  const state = value && typeof value === "object" ? value : {};
  return JSON.stringify({
    tripSettings: state.tripSettings || null,
    schedule: state.schedule || null,
    adjust: state.adjust || null,
    settlement: state.settlement || null,
    checklist: state.checklist || null,
    notes: state.notes || null,
    spots: Array.isArray(state.spots) ? state.spots : [],
  });
}

async function createGroup(env, request) {
  const body = await readBody(request);
  const id = makeId("grp");
  const editToken = makeId("tok");
  const name = String(body.name || "旅行グループ").trim().slice(0, 40) || "旅行グループ";
  const stateJson = sanitizeState(body.state);

  let joinCode = makeJoinCode();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const existing = await env.DB.prepare("SELECT id FROM groups WHERE join_code = ?").bind(joinCode).first();
    if (!existing) break;
    joinCode = makeJoinCode();
  }

  await env.DB.prepare(
    "INSERT INTO groups (id, name, join_code, edit_token, state_json) VALUES (?, ?, ?, ?, ?)",
  )
    .bind(id, name, joinCode, editToken, stateJson)
    .run();

  return json({
    group: {
      id,
      name,
      joinCode,
      editToken,
      state: JSON.parse(stateJson),
    },
  });
}

async function joinGroup(env, request) {
  const body = await readBody(request);
  const joinCode = String(body.joinCode || "").replace(/\D/g, "").slice(0, 6);

  if (joinCode.length !== 6) {
    return json({ error: "参加コードは6桁で入力してください。" }, 400);
  }

  const group = await env.DB.prepare(
    "SELECT id, name, join_code, edit_token, state_json FROM groups WHERE join_code = ?",
  )
    .bind(joinCode)
    .first();

  if (!group) {
    return json({ error: "グループが見つかりませんでした。" }, 404);
  }

  return json({
    group: {
      id: group.id,
      name: group.name,
      joinCode: group.join_code,
      editToken: group.edit_token,
      state: JSON.parse(group.state_json),
    },
  });
}

async function readGroup(env, request, id) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") || "";
  const group = await env.DB.prepare(
    "SELECT id, name, join_code, edit_token, state_json, updated_at FROM groups WHERE id = ?",
  )
    .bind(id)
    .first();

  if (!group || token !== group.edit_token) {
    return json({ error: "グループを読み込めませんでした。" }, 404);
  }

  return json({
    group: {
      id: group.id,
      name: group.name,
      joinCode: group.join_code,
      editToken: group.edit_token,
      updatedAt: group.updated_at,
      state: JSON.parse(group.state_json),
    },
  });
}

async function updateGroup(env, request, id) {
  const body = await readBody(request);
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || body.editToken || "";
  const stateJson = sanitizeState(body.state);

  const group = await env.DB.prepare("SELECT edit_token FROM groups WHERE id = ?").bind(id).first();
  if (!group || token !== group.edit_token) {
    return json({ error: "グループを更新できませんでした。" }, 403);
  }

  await env.DB.prepare("UPDATE groups SET state_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
    .bind(stateJson, id)
    .run();

  return json({ ok: true, state: JSON.parse(stateJson) });
}

export async function onRequest({ request, env, params }) {
  if (!env.DB) {
    return json({ error: "グループ共有の保存先が未設定です。" }, 500);
  }

  const method = request.method.toUpperCase();
  const parts = String(params.path || "")
    .split("/")
    .filter(Boolean);

  if (method === "POST" && parts.length === 0) return createGroup(env, request);
  if (method === "POST" && parts[0] === "join") return joinGroup(env, request);
  if (method === "GET" && parts.length === 1) return readGroup(env, request, parts[0]);
  if (method === "PUT" && parts.length === 1) return updateGroup(env, request, parts[0]);

  return json({ error: "Not found" }, 404);
}
