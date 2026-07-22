import type { AdjustState, ChecklistState, NotesState, ScheduleDay, ScheduleState, SettlementState, TripSettings } from "./types";

export const defaultTripSettings: TripSettings = {
  tripName: "旅のしおり",
  startDate: "2026-09-21",
  endDate: "2026-09-23",
  dateLabel: "2026.09.21 - 09.23",
  routeLabel: "大阪から都城へ",
  heroRouteLabel: "Osaka to Miyakonojo",
  outboundLabel: "MM193 08:30 関西発",
  returnLabel: "MM198 16:30 鹿児島発",
  hotelName: "都城グリーンホテル",
  hotelAddress: "宮崎県都城市栄町27-2-1",
  departureTime: "05:40",
  arrivalTargetTime: "07:15",
  mapOrigin: "鹿児島空港",
  mapDestination: "都城グリーンホテル",
  mapOriginLat: 31.803333,
  mapOriginLng: 130.719444,
  mapDestinationLat: 31.7362,
  mapDestinationLng: 131.0743,
  mapNote: "鹿児島空港についたら都城方面へ移動。",
};

export const scheduleDays: ScheduleDay[] = [
  { id: "2026-09-21", label: "9月21日（月）", shortLabel: "9/21" },
  { id: "2026-09-22", label: "9月22日（火）", shortLabel: "9/22" },
  { id: "2026-09-23", label: "9月23日（水）", shortLabel: "9/23" },
];

export function getScheduleDays(settings: TripSettings): ScheduleDay[] {
  const start = new Date(`${settings.startDate}T00:00:00`);
  const end = new Date(`${settings.endDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return scheduleDays;
  const formatter = new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric", weekday: "short" });
  const short = new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric" });
  const days: ScheduleDay[] = [];
  const cursor = new Date(start);
  while (cursor <= end && days.length < 14) {
    const id = [cursor.getFullYear(), String(cursor.getMonth() + 1).padStart(2, "0"), String(cursor.getDate()).padStart(2, "0")].join("-");
    days.push({ id, label: formatter.format(cursor), shortLabel: short.format(cursor) });
    cursor.setDate(cursor.getDate() + 1);
  }
  return days.length ? days : scheduleDays;
}

export const defaultSchedule: ScheduleState = {
  activeDay: scheduleDays[0].id,
  items: [
    { id: "schedule-ikoaka", day: "2026-09-21", time: "05:40", title: "市岡元町を出る", memo: "弁天町駅まで徒歩10分。朝早いので少し余裕を持つ。", mapUrl: "", isTimeUnset: false },
    { id: "schedule-bentencho", day: "2026-09-21", time: "05:50", title: "弁天町駅", memo: "弁天町から関空まで、1人片道1,180円。", mapUrl: "", isTimeUnset: false },
    { id: "schedule-kix-station", day: "2026-09-21", time: "07:00", title: "関西空港駅", memo: "エアロプラザ1階から第2ターミナル行きの無料連絡バスへ。", mapUrl: "", isTimeUnset: false },
    { id: "schedule-kix-t2", day: "2026-09-21", time: "07:15", title: "関空第2ターミナル", memo: "Peachのチェックイン、手荷物、保安検査へ。", mapUrl: "", isTimeUnset: false },
    { id: "schedule-mm193", day: "2026-09-21", time: "08:30", title: "MM193 出発", memo: "関西空港から鹿児島空港へ。09:45到着予定。", mapUrl: "", isTimeUnset: false },
    { id: "schedule-mm198", day: "2026-09-23", time: "16:30", title: "MM198 復路出発", memo: "鹿児島空港から関西空港へ。17:50到着予定。", mapUrl: "", isTimeUnset: false },
  ],
};

export const defaultAdjust: AdjustState = {
  breakfast: false,
  hotelNoBreakfast: 6500,
  hotelBreakfast: 9100,
  customItems: [],
  souvenirs: [],
};

export const defaultSettlement: SettlementState = {
  people: [
    { id: "person-1", name: "たつき", role: "メンバー", memo: "" },
    { id: "person-2", name: "同行者", role: "メンバー", memo: "" },
  ],
  payments: [],
};

export const defaultChecklist: ChecklistState = {
  items: ["交通手段の予約", "宿の予約", "身分証", "スマホ", "充電器", "モバイルバッテリー", "着替え", "洗面用品", "常備薬", "雨具", "現金・交通系IC", "お土産メモ"].map((label) => ({
    id: `default-${label}`,
    label,
    checked: false,
    removable: true,
  })),
};

export const defaultNotes: NotesState = {
  items: [
    "出発時間と集合場所は前日までに決めておく。",
    "交通機関のチェックイン時間、乗り場、荷物ルールを確認しておく。",
    "宿は料金、禁煙・喫煙、チェックイン時間、キャンセル条件だけ最後に見ておく。",
  ].map((text, index) => ({ id: `default-note-${index}`, text })),
};

export const baseCost = { flight: 36200, access: 2360 };
