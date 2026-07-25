import { cookie, createSession, decodeAndValidateIdToken, ensureAuthTables, hashValue, makeToken, parseCookies, resolveSession } from "../auth-shared.js";

const jsonHeaders = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" };
const json = (data, status = 200, extraHeaders = {}) => new Response(JSON.stringify(data), { status, headers: { ...jsonHeaders, ...extraHeaders } });

function redirect(location, cookies = []) {
  const headers = new Headers({ location, "cache-control": "no-store" });
  cookies.forEach((value) => headers.append("set-cookie", value));
  return new Response(null, { status: 302, headers });
}

async function googleLogin(env, request) {
  if (!env.GOOGLE_CLIENT_ID) return json({ error: "Google認証が設定されていません。" }, 503);
  const verifier = makeToken("pkce", 32);
  const state = makeToken("state", 24);
  const challengeBytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
  const challenge = btoa(String.fromCharCode(...challengeBytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const redirectUri = `${new URL(request.url).origin}/api/auth/callback`;
  const params = new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, redirect_uri: redirectUri, response_type: "code", scope: "openid email profile", state, code_challenge: challenge, code_challenge_method: "S256" });
  return redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`, [cookie("oauth_state", state, 600), cookie("oauth_verifier", verifier, 600)]);
}

async function googleCallback(env, request) {
  const url = new URL(request.url);
  const cookies = parseCookies(request);
  const state = url.searchParams.get("state") || "";
  const code = url.searchParams.get("code") || "";
  if (!state || !code || state !== cookies.oauth_state || !cookies.oauth_verifier) return json({ error: "認証状態を確認できませんでした。もう一度お試しください。" }, 400);
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return json({ error: "Google認証が設定されていません。" }, 503);
  if (!env.DB) return json({ error: "認証の保存先が未設定です。" }, 500);
  await ensureAuthTables(env);
  const redirectUri = `${url.origin}/api/auth/callback`;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, code_verifier: cookies.oauth_verifier, redirect_uri: redirectUri, grant_type: "authorization_code" }),
  });
  if (!response.ok) return json({ error: "Google認証を完了できませんでした。" }, 401);
  const tokenResponse = await response.json() as { id_token?: string };
  let profile;
  try { profile = decodeAndValidateIdToken(tokenResponse.id_token, env.GOOGLE_CLIENT_ID); }
  catch (error) { return json({ error: error instanceof Error ? error.message : "Google認証を確認できませんでした。" }, 401); }
  const existing = await env.DB.prepare("SELECT id FROM users WHERE provider = 'google' AND provider_sub = ?").bind(String(profile.sub)).first();
  const userId = existing?.id || makeToken("usr", 12);
  await env.DB.prepare("INSERT INTO users (id, provider, provider_sub, email, display_name, created_at) VALUES (?, 'google', ?, ?, ?, ?) ON CONFLICT(provider, provider_sub) DO UPDATE SET email = excluded.email, display_name = excluded.display_name").bind(userId, String(profile.sub), String(profile.email || ""), String(profile.name || ""), Date.now()).run();
  const session = await createSession(env, userId);
  return redirect(`${url.origin}/#share`, [cookie("session", session, 90 * 24 * 60 * 60), cookie("oauth_state", "", 0), cookie("oauth_verifier", "", 0)]);
}

async function me(env, request) {
  const user = await resolveSession(env, request);
  return user ? json({ user }) : json({ error: "ログインしていません。" }, 401);
}

async function logout(env, request) {
  const token = parseCookies(request).session || "";
  if (token) await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await hashValue(token)).run();
  return json({ ok: true }, 200, { "set-cookie": cookie("session", "", 0) });
}

export async function onRequest({ request, env, params }) {
  try {
    const method = request.method.toUpperCase();
    const path = String(params.path || "");
    if (method === "GET" && path === "google") return googleLogin(env, request);
    if (method === "GET" && path === "callback") return googleCallback(env, request);
    if (!env.DB) return json({ error: "認証の保存先が未設定です。" }, 500);
    await ensureAuthTables(env);
    if (method === "GET" && path === "me") return me(env, request);
    if (method === "POST" && path === "logout") return logout(env, request);
    return json({ error: "Not found" }, 404);
  } catch { return json({ error: "サーバーで処理できませんでした。" }, 500); }
}
