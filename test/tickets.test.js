import assert from "node:assert/strict";
import test from "node:test";
import { buildTicketRoute, migrateToTickets, parseLatLng, parsePlaceName, placeQueryCandidates, resolvePlace, routeLine, sortTickets, stayForDay, ticketStatus } from "../src/tickets.ts";

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

// --- 描画用の座標列 -------------------------------------------------------

const pt = (id, lat, lng) => ({ id, title: id, lat, lng, day: "", time: "" });

test("経路の線は地点を順につなぎ、両端が最初と最後の地点に一致する", () => {
  const line = routeLine([pt("a", 31.8, 130.7), pt("b", 31.7, 131.0), pt("c", 33.6, 130.4)]);
  assert.ok(line.length > 2);
  assert.deepEqual(line[0].map((v) => Math.round(v * 10) / 10), [130.7, 31.8]);
  assert.deepEqual(line[line.length - 1].map((v) => Math.round(v * 10) / 10), [130.4, 33.6]);
});

test("地点が1つ以下なら線は引けない", () => {
  assert.deepEqual(routeLine([]), []);
  assert.deepEqual(routeLine([pt("a", 31.8, 130.7)]), []);
});

// --- 経路の出どころ -------------------------------------------------------

test("予定から作れた経路は source が schedule になる", () => {
  const route = buildTicketRoute(state({ schedule: { items: [
    item({ id: "a", title: "駅", lat: 34.66, lng: 135.42 }),
    item({ id: "b", title: "空港", lat: 34.78, lng: 135.43 }),
  ] } }));
  assert.equal(route.source, "schedule");
});

test("地図に付けた場所名は予定名と別に経路へ表示される", () => {
  const route = buildTicketRoute(state({ schedule: { items: [
    item({ id: "a", title: "待ち合わせ", locationName: "宮崎駅", lat: 31.915, lng: 131.432 }),
    item({ id: "b", title: "観光", locationName: "青島神社", lat: 31.804, lng: 131.475 }),
  ] } }));
  assert.deepEqual(route.points.map((point) => point.title), ["宮崎駅", "青島神社"]);
});

test("旅行設定へ落ちた経路は source が settings になる", () => {
  const route = buildTicketRoute(state({ tripSettings: { mapOrigin: "空港", mapDestination: "ホテル", mapOriginLat: 31.8, mapOriginLng: 130.7, mapDestinationLat: 31.7, mapDestinationLng: 131.0 } }));
  assert.equal(route.source, "settings");
});

// 設定側は地名と緯度経度を別々に編集できるため、両者が食い違いうる。
// 表示側が source を見ずに「名前はA、地図はBの座標」と混ぜないための番人。
test("設定由来の経路では、地点名が設定の地名と一致する", () => {
  const route = buildTicketRoute(state({ tripSettings: { mapOrigin: "弁天町", mapDestination: "北海道大学", mapOriginLat: 31.8, mapOriginLng: 130.7, mapDestinationLat: 31.7, mapDestinationLng: 131.0 } }));
  assert.equal(route.source, "settings");
  assert.deepEqual(route.points.map((p) => p.title), ["弁天町", "北海道大学"]);
});

// --- URL 1本から場所を決める ----------------------------------------------

test("place 形式のURLから地名を取り出す", () => {
  assert.equal(parsePlaceName("https://www.google.com/maps/place/%E5%A4%A7%E9%98%AA%E9%A7%85/@34.7024,135.4959,17z"), "大阪駅");
  assert.equal(parsePlaceName("https://www.google.com/maps/place/Kagoshima+Airport/@31.8034,130.7194,15z"), "Kagoshima Airport");
  assert.equal(parsePlaceName("https://www.google.com/maps/@34.6659,135.4297,15z"), null);
  assert.equal(parsePlaceName(""), null);
});

test("地名と座標は同じURLから来るので食い違わない", () => {
  const place = resolvePlace("https://www.google.com/maps/place/%E5%A4%A7%E9%98%AA%E9%A7%85/@34.7024,135.4959,17z");
  assert.equal(place.name, "大阪駅");
  assert.equal(place.lat, 34.7024);
  assert.equal(place.lng, 135.4959);
});

test("地名の無いURLは label で補い、label も無ければ座標を名前にする", () => {
  assert.equal(resolvePlace("https://www.google.com/maps/@34.6659,135.4297,15z", "弁天町").name, "弁天町");
  assert.equal(resolvePlace("https://www.google.com/maps/@34.6659,135.4297,15z").name, "34.6659, 135.4297");
});

test("座標が取れないURLは場所として成立しない", () => {
  assert.equal(resolvePlace("https://maps.app.goo.gl/AbCdEfG", "どこか"), null);
  assert.equal(resolvePlace(""), null);
});

// --- 宿の引き継ぎ ---------------------------------------------------------

const stay = (day, title) => item({ id: `s-${day}`, day, title, isStay: true, lat: 1, lng: 1 });

test("その日の宿があればそれを使う", () => {
  const items = [stay("2026-09-21", "宿A"), stay("2026-09-22", "宿B")];
  assert.equal(stayForDay(items, "2026-09-22").title, "宿B");
});

test("その日の宿が無ければ直前の日の宿を引き継ぐ", () => {
  const items = [stay("2026-09-21", "宿A")];
  assert.equal(stayForDay(items, "2026-09-23").title, "宿A");
});

test("最初の日より前には引き継ぐ宿が無い", () => {
  assert.equal(stayForDay([stay("2026-09-22", "宿B")], "2026-09-21"), null);
  assert.equal(stayForDay([], "2026-09-21"), null);
});

test("URLがあれば旧フィールドより優先され、地名と座標がURLから揃う", () => {
  const route = buildTicketRoute(state({ tripSettings: {
    mapOriginUrl: "https://www.google.com/maps/place/%E5%A4%A7%E9%98%AA%E9%A7%85/@34.7024,135.4959,17z",
    mapOrigin: "古い名前", mapOriginLat: 31.8, mapOriginLng: 130.7,
    mapDestinationUrl: "", mapDestination: "ホテル", mapDestinationLat: 31.7, mapDestinationLng: 131.0,
  } }));
  assert.equal(route.points[0].title, "大阪駅");
  assert.equal(route.points[0].lat, 34.7024);
});

// --- ?q= からの検索候補 ---------------------------------------------------
// Nominatim は住所の全体では引けず、施設名なら引ける。切り出しを誤ると
// 「見つからない」が量産されるので、順番まで含めて固定する。

test("郵便番号と括弧を捨て、施設名を先に試す", () => {
  const url = "https://www.google.com/maps?q=" + encodeURIComponent("〒560-0036 大阪府豊中市螢池西町３丁目５５５ 大阪国際空港 (ITM)");
  assert.deepEqual(placeQueryCandidates(url), ["大阪国際空港", "大阪府豊中市螢池西町３丁目５５５ 大阪国際空港"]);
});

test("語が1つだけならそれをそのまま使う", () => {
  assert.deepEqual(placeQueryCandidates("https://www.google.com/maps?q=" + encodeURIComponent("東京駅")), ["東京駅"]);
});

test("q= が座標そのものなら検索の出番はない", () => {
  assert.deepEqual(placeQueryCandidates("https://maps.google.com/?q=35.6812,139.7671"), []);
});

test("q= が無いURLからは候補が出ない", () => {
  assert.deepEqual(placeQueryCandidates("https://www.google.com/maps/@34.66,135.45,15z"), []);
  assert.deepEqual(placeQueryCandidates("not a url"), []);
});
