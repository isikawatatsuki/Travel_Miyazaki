import assert from "node:assert/strict";
import test from "node:test";
import { buildTicketRoute, migrateToTickets, parseLatLng, sortTickets, ticketStatus } from "../src/tickets.ts";

const settings = (extra = {}) => ({ startDate: "2026-09-21", endDate: "2026-09-23", mapOrigin: "", mapDestination: "", mapOriginLat: 0, mapOriginLng: 0, mapDestinationLat: 0, mapDestinationLng: 0, ...extra });
const state = (extra = {}) => ({ tripSettings: settings(extra.tripSettings), schedule: { activeDay: "", items: [], ...extra.schedule }, settlement: { people: [], payments: [] } });
const ticket = (extra = {}) => ({ id: "t1", name: "旅", createdAt: "", updatedAt: "", archived: false, themeColor: "#000", state: state(), ...extra });

// --- 状態 -------------------------------------------------------------------

test("状態は日付から決まり、手動の完了とアーカイブが優先される", () => {
  assert.equal(ticketStatus(ticket(), "2026-09-01"), "planning");
  assert.equal(ticketStatus(ticket(), "2026-09-22"), "traveling");
  assert.equal(ticketStatus(ticket(), "2026-09-24"), "done");
  assert.equal(ticketStatus(ticket({ archived: true }), "2026-09-01"), "archived");
  assert.equal(ticketStatus(ticket({ completedAt: "2026-09-22" }), "2026-09-22"), "done");
});

test("日程が壊れていても画面から消えないよう planning に倒す", () => {
  assert.equal(ticketStatus(ticket({ state: state({ tripSettings: { startDate: "", endDate: "" } }) }), "2026-09-01"), "planning");
});

// --- 座標 -------------------------------------------------------------------

test("地図URLから緯度経度を取り出す", () => {
  assert.deepEqual(parseLatLng("https://www.google.com/maps/@31.7362,131.0743,15z"), { lat: 31.7362, lng: 131.0743 });
  assert.deepEqual(parseLatLng("https://www.google.com/maps/place/X/data=!3d31.7!4d131.07"), { lat: 31.7, lng: 131.07 });
  assert.deepEqual(parseLatLng("https://maps.google.com/?q=35.6812,139.7671"), { lat: 35.6812, lng: 139.7671 });
  assert.equal(parseLatLng("https://example.com/no-coords"), null);
  assert.equal(parseLatLng(""), null);
});

test("範囲外や 0,0 の座標は採用しない", () => {
  assert.equal(parseLatLng("https://maps.google.com/?q=0.0,0.0"), null);
  assert.equal(parseLatLng("https://www.google.com/maps/@99.1,200.2,15z"), null);
});

// --- 経路 -------------------------------------------------------------------

const item = (extra) => ({ id: "s", day: "2026-09-21", time: "", title: "", memo: "", mapUrl: "", isTimeUnset: true, ...extra });

test("経路は日付と時刻の順に並ぶ", () => {
  const route = buildTicketRoute(state({ schedule: { items: [
    item({ id: "b", day: "2026-09-21", time: "15:00", isTimeUnset: false, title: "後", lat: 2, lng: 2 }),
    item({ id: "a", day: "2026-09-21", time: "09:00", isTimeUnset: false, title: "先", lat: 1, lng: 1 }),
    item({ id: "c", day: "2026-09-22", time: "08:00", isTimeUnset: false, title: "翌日", lat: 3, lng: 3 }),
  ] } }));
  assert.deepEqual(route.points.map((point) => point.title), ["先", "後", "翌日"]);
});

test("inRoute が false の予定は経路から外れる", () => {
  const route = buildTicketRoute(state({ schedule: { items: [
    item({ id: "a", title: "含む", lat: 1, lng: 1 }),
    item({ id: "b", title: "外す", lat: 2, lng: 2, inRoute: false }),
  ] } }));
  assert.deepEqual(route.points.map((point) => point.title), ["含む"]);
});

test("inRoute が未設定の既存データは経路に含まれる", () => {
  const route = buildTicketRoute(state({ schedule: { items: [item({ id: "a", title: "旧データ", lat: 1, lng: 1 }), item({ id: "b", title: "旧2", lat: 2, lng: 2 })] } }));
  assert.equal(route.points.length, 2);
});

test("座標が取れない予定は除外して名前を skipped へ残す", () => {
  const route = buildTicketRoute(state({ schedule: { items: [
    item({ id: "a", title: "座標あり", lat: 1, lng: 1 }),
    item({ id: "b", title: "座標なし" }),
  ] } }));
  assert.deepEqual(route.points.map((point) => point.title), ["座標あり"]);
  assert.deepEqual(route.skipped, ["座標なし"]);
});

test("連続する同一地点は1点に畳む", () => {
  const route = buildTicketRoute(state({ schedule: { items: [
    item({ id: "a", time: "09:00", isTimeUnset: false, title: "宿", lat: 1, lng: 1 }),
    item({ id: "b", time: "10:00", isTimeUnset: false, title: "宿で朝食", lat: 1, lng: 1 }),
    item({ id: "c", time: "11:00", isTimeUnset: false, title: "観光", lat: 2, lng: 2 }),
  ] } }));
  assert.deepEqual(route.points.map((point) => point.title), ["宿", "観光"]);
});

test("予定に座標が無ければ旅行設定の出発地と目的地で線を引く", () => {
  const route = buildTicketRoute(state({ tripSettings: { mapOrigin: "空港", mapDestination: "ホテル", mapOriginLat: 31.8, mapOriginLng: 130.7, mapDestinationLat: 31.7, mapDestinationLng: 131.0 } }));
  assert.deepEqual(route.points.map((point) => point.title), ["空港", "ホテル"]);
});

// --- 移行 -------------------------------------------------------------------

test("既存の旅行はすべてチケットになり、テーマカラーが付く", () => {
  const tickets = migrateToTickets({ trips: [
    { id: "a", name: "旅1", createdAt: "", updatedAt: "", archived: false, state: state() },
    { id: "b", name: "旅2", createdAt: "", updatedAt: "", archived: false, state: state() },
  ] });
  assert.equal(tickets.length, 2);
  assert.ok(tickets.every((entry) => /^#[0-9a-f]{6}$/i.test(entry.themeColor)));
});

test("開いていたグループは開いていた旅行へ紐付く", () => {
  const tickets = migrateToTickets({
    trips: [
      { id: "a", name: "旅1", createdAt: "", updatedAt: "", archived: false, state: state() },
      { id: "b", name: "旅2", createdAt: "", updatedAt: "", archived: false, state: state() },
    ],
    groups: [{ id: "g1", name: "共有", joinCode: "123456", editToken: "edit" }],
    activeGroup: { id: "g1", name: "共有", joinCode: "123456", editToken: "edit" },
    activeTripId: "b",
  });
  assert.equal(tickets.find((entry) => entry.id === "b").groupId, "g1");
  assert.equal(tickets.find((entry) => entry.id === "b").editToken, "edit");
  assert.equal(tickets.find((entry) => entry.id === "a").groupId, undefined);
});

test("対応する旅行が無いグループは新しいチケットになる（データを落とさない）", () => {
  const tickets = migrateToTickets({
    trips: [{ id: "a", name: "旅1", createdAt: "", updatedAt: "", archived: false, state: state() }],
    groups: [{ id: "g9", name: "端末に無い旅", joinCode: "999999", state: state() }],
  });
  assert.equal(tickets.length, 2);
  assert.equal(tickets[1].groupId, "g9");
  assert.equal(tickets[1].joinCode, "999999");
});

test("名前が一致するグループは同名の旅行へ紐付く", () => {
  const tickets = migrateToTickets({
    trips: [{ id: "a", name: "宮崎旅行", createdAt: "", updatedAt: "", archived: false, state: state() }],
    groups: [{ id: "g2", name: "宮崎旅行", joinCode: "222222" }],
  });
  assert.equal(tickets.length, 1);
  assert.equal(tickets[0].groupId, "g2");
});

test("移行済みならそのまま返し、二度目の移行で作り直さない", () => {
  const existing = [ticket({ id: "kept", groupId: "g1" })];
  const tickets = migrateToTickets({ tickets: existing, trips: [{ id: "a", name: "無視される", createdAt: "", updatedAt: "", archived: false, state: state() }] });
  assert.deepEqual(tickets, existing);
});

test("並び順は 旅行中 → 計画中 → 完了 → アーカイブ", () => {
  const sorted = sortTickets([
    ticket({ id: "done", state: state({ tripSettings: { startDate: "2026-01-01", endDate: "2026-01-02" } }) }),
    ticket({ id: "archived", archived: true }),
    ticket({ id: "traveling", state: state({ tripSettings: { startDate: "2026-09-21", endDate: "2026-09-23" } }) }),
    ticket({ id: "planning", state: state({ tripSettings: { startDate: "2026-12-01", endDate: "2026-12-03" } }) }),
  ], "2026-09-22");
  assert.deepEqual(sorted.map((entry) => entry.id), ["traveling", "planning", "done", "archived"]);
});
