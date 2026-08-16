import assert from "node:assert/strict";
import test from "node:test";
import { decodeAndValidateIdToken, parseCookies, resolveSession } from "../functions/api/auth-shared.js";
import { onRequest as authRequest } from "../functions/api/auth/[[path]].ts";
import { claimGroup, resolveAccess } from "../functions/api/groups/[[path]].ts";

function jwt(payload) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none" })}.${encode(payload)}.`;
}

test("Google id_token の aud・iss・exp を検証する", () => {
  const now = Date.now();
  const profile = decodeAndValidateIdToken(jwt({ sub: "123", aud: "client", iss: "https://accounts.google.com", exp: Math.floor(now / 1000) + 60 }), "client", now);
  assert.equal(profile.sub, "123");
  assert.throws(() => decodeAndValidateIdToken(jwt({ sub: "123", aud: "other", iss: "https://accounts.google.com", exp: Math.floor(now / 1000) + 60 }), "client", now));
});

// 全画面遷移で開かれるため、拒否は 400 ではなくアプリへの302で返す。
// 守るべき性質は「セッションを発行しないこと」なので、そこを直接確かめる。
test("callback は state 不一致を拒否し、セッションを発行しない", async () => {
  const response = await authRequest({
    request: new Request("https://example.com/api/auth/callback?code=abc&state=wrong", { headers: { cookie: "oauth_state=expected; oauth_verifier=verifier" } }),
    env: {},
    params: { path: "callback" },
  });
  assert.equal(response.status, 302);
  assert.match(response.headers.get("location"), /\?authError=state#share$/);
  assert.ok(!response.headers.getSetCookie().some((value) => /^session=[^;]/.test(value)));
});

test("設定不足の /api/auth/google はJSONを出さずアプリへ戻す", async () => {
  const response = await authRequest({
    request: new Request("https://example.com/api/auth/google"),
    env: {},
    params: { path: "google" },
  });
  assert.equal(response.status, 302);
  assert.match(response.headers.get("location"), /\?authError=not_configured#share$/);
});

test("期限切れセッションを拒否して削除する", async () => {
  let deleted = false;
  const statement = {
    bind() { return this; },
    async first() { return { user_id: "usr_1", expires_at: Date.now() - 1, email: "a@example.com", display_name: "A" }; },
    async run() { deleted = true; },
  };
  const user = await resolveSession({ DB: { prepare: () => statement } }, new Request("https://example.com", { headers: { cookie: "session=expired" } }));
  assert.equal(user, null);
  assert.equal(deleted, true);
  assert.equal(parseCookies(new Request("https://example.com", { headers: { cookie: "a=1; b=hello%20world" } })).b, "hello world");

  const allowed = await resolveAccess(
    { DB: { prepare: () => statement } },
    new Request("https://example.com", { headers: { cookie: "session=expired" } }),
    { id: "grp_1", edit_token: "" },
    "read",
  );
  assert.equal(allowed, false);
});

test("未ログインでも従来の Bearer 編集トークンを利用できる", async () => {
  const db = {
    prepare(sql) {
      return {
        bind() { return this; },
        async first() {
          if (sql.includes("FROM group_tokens")) return { permission: "edit", expires_at: Date.now() + 60_000 };
          return null;
        },
      };
    },
  };
  const allowed = await resolveAccess(
    { DB: db },
    new Request("https://example.com", { headers: { authorization: "Bearer legacy-edit-token" } }),
    { id: "grp_1", edit_token: "" },
    "edit",
  );
  assert.equal(allowed, true);
});

test("owner がいるグループへの claim は editor を返す", async () => {
  let insertedRole = "";
  const db = {
    prepare(sql) {
      const statement = {
        values: [],
        bind(...values) { this.values = values; return this; },
        async first() {
          if (sql.includes("FROM sessions JOIN users")) return { user_id: "usr_new", expires_at: Date.now() + 60_000, email: "new@example.com", display_name: "New" };
          if (sql.includes("SELECT id, edit_token FROM groups")) return { id: "grp_1", edit_token: "" };
          if (sql.includes("FROM group_tokens")) return { permission: "edit", expires_at: Date.now() + 60_000 };
          if (sql.includes("user_id = ?")) return null;
          if (sql.includes("role = 'owner'")) return { user_id: "usr_owner" };
          return null;
        },
        async run() {
          if (sql.includes("INSERT OR REPLACE INTO group_members")) insertedRole = this.values[2];
        },
      };
      return statement;
    },
  };
  const response = await claimGroup(
    { DB: db },
    new Request("https://example.com/api/groups/grp_1/claim", { method: "POST", headers: { cookie: "session=valid", authorization: "Bearer valid-edit-token" } }),
    "grp_1",
  );
  assert.equal(response.status, 200);
  assert.equal((await response.json()).role, "editor");
  assert.equal(insertedRole, "editor");
});
