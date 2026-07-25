import assert from "node:assert/strict";
import test from "node:test";
import { onRequest } from "../functions/api/resolve.ts";

const post = (body) => new Request("https://example.com/api/resolve", {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
});
const env = {};

test("POST 以外は受け付けない", async () => {
  const res = await onRequest({ request: new Request("https://example.com/api/resolve"), env });
  assert.equal(res.status, 404);
});

// 任意のURLを取得できると SSRF になる。ここが番人。
test("短縮リンク以外のホストは拒否する", async () => {
  for (const url of [
    "https://example.com/whatever",
    "http://maps.app.goo.gl/abc",          // https 以外
    "https://evil.com/maps.app.goo.gl/abc",
    "https://maps.app.goo.gl.evil.com/abc",
    "https://169.254.169.254/latest/meta-data/",
    "file:///etc/passwd",
  ]) {
    const res = await onRequest({ request: post({ url }), env });
    assert.equal(res.status, 400, `許可されてはいけない: ${url}`);
  }
});

test("URLが無い・壊れている場合は400", async () => {
  assert.equal((await onRequest({ request: post({}), env })).status, 400);
  assert.equal((await onRequest({ request: post({ url: "not a url" }), env })).status, 400);
});

test("展開先がGoogleマップでなければ受け入れない", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(null, { status: 302, headers: { location: "https://evil.com/steal" } });
  try {
    const res = await onRequest({ request: post({ url: "https://maps.app.goo.gl/abc" }), env });
    assert.equal(res.status, 422);
  } finally { globalThis.fetch = original; }
});

test("Googleマップへの展開先はそのまま返す", async () => {
  const target = "https://www.google.com/maps/place/%E5%A4%A7%E9%98%AA%E9%A7%85/@34.7024,135.4959,17z";
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(null, { status: 302, headers: { location: target } });
  try {
    const res = await onRequest({ request: post({ url: "https://maps.app.goo.gl/abc" }), env });
    assert.equal(res.status, 200);
    assert.equal((await res.json()).url, target);
  } finally { globalThis.fetch = original; }
});
