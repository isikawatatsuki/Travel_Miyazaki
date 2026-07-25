import assert from "node:assert/strict";
import test from "node:test";
import { onRequest } from "../functions/api/groups/[[path]].ts";

/**
 * try の中で `return handler(...)` と書くと、Promise の reject は catch へ届かず
 * Worker の未捕捉例外になる。正常系は素通りするため、エラー経路でしか露見しない。
 * ここは「エラーがJSONとして返る」ことを確かめる番人。
 */
const db = {
  prepare() { return this; },
  bind() { return this; },
  async first() { return undefined; },   // 見つからない＝ApiError を投げる経路
  async run() { return {}; },
  async batch() { return []; },
};
const env = { DB: db };

test("存在しないグループはJSONの404を返す（Workerを落とさない）", async () => {
  const res = await onRequest({
    request: new Request("https://example.com/api/groups/nope"),
    env, params: { path: "nope" },
  });
  assert.equal(res.status, 404);
  assert.equal(res.headers.get("content-type"), "application/json; charset=utf-8");
  assert.ok((await res.json()).error);
});

test("参加コードが6桁でなければJSONの400を返す", async () => {
  const res = await onRequest({
    request: new Request("https://example.com/api/groups/join", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ joinCode: "12" }),
    }),
    env, params: { path: "join" },
  });
  assert.equal(res.status, 400);
  assert.ok((await res.json()).error);
});

test("DB未設定でもJSONの500を返す", async () => {
  const res = await onRequest({
    request: new Request("https://example.com/api/groups/x"),
    env: {}, params: { path: "x" },
  });
  assert.equal(res.status, 500);
  assert.ok((await res.json()).error);
});
