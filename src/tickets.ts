import type { Group, ScheduleItem, SharedState, Ticket, TicketStatus, TravelProfile } from "./types";

/** チケットの初期テーマカラー。パステル寄りで、白文字ではなく濃色文字を載せる前提の彩度。 */
export const TICKET_COLORS = ["#e8735f", "#2f9e8f", "#6d83c9", "#d9853b", "#b5679a", "#4f8f5b"];

export function defaultThemeColor(seed: number) {
  return TICKET_COLORS[Math.abs(seed) % TICKET_COLORS.length];
}

function today() {
  const now = new Date();
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-");
}

/**
 * 状態は日付から自動で決まる。archived と completedAt だけが手動の上書き。
 * 日付が壊れている既存データは planning に倒す（画面から消えるより良い）。
 */
export function ticketStatus(ticket: Ticket, now = today()): TicketStatus {
  if (ticket.archived) return "archived";
  if (ticket.completedAt) return "done";
  const { startDate, endDate } = ticket.state.tripSettings;
  if (!startDate || !endDate) return "planning";
  if (now > endDate) return "done";
  if (now >= startDate) return "traveling";
  return "planning";
}

export const STATUS_LABELS: Record<TicketStatus, string> = {
  planning: "計画中",
  traveling: "旅行中",
  done: "完了",
  archived: "アーカイブ",
};

/** 出発までの残り日数。旅行中は0、過ぎていれば負。日付が無ければ null。 */
export function daysUntilStart(ticket: Ticket, now = today()): number | null {
  const start = ticket.state.tripSettings.startDate;
  if (!start) return null;
  const from = Date.parse(`${now}T00:00:00Z`);
  const to = Date.parse(`${start}T00:00:00Z`);
  if (Number.isNaN(from) || Number.isNaN(to)) return null;
  return Math.round((to - from) / 86_400_000);
}

export function countdownLabel(ticket: Ticket, now = today()): string {
  const status = ticketStatus(ticket, now);
  if (status === "archived") return "アーカイブ済み";
  if (status === "done") return "旅行完了";
  if (status === "traveling") return "旅行中";
  const days = daysUntilStart(ticket, now);
  if (days === null) return "日程未定";
  return days === 0 ? "いよいよ今日" : `あと${days}日`;
}

// ---------------------------------------------------------------------------
// 座標の取り出し
// ---------------------------------------------------------------------------

/**
 * 予定に貼られた地図URLから緯度経度を取り出す。外部APIもAPIキーも使わない。
 * ユーザーは既にGoogleマップのURLを貼る運用をしているので、追加操作がほぼ要らない。
 * ponytail: 正規表現によるURL解析。Googleがリンク形式を変えたら手入力欄で凌ぐ。
 */
export function parseLatLng(mapUrl: string): { lat: number; lng: number } | null {
  if (!mapUrl) return null;
  const patterns = [
    /!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/,        // /place/…!3d35.68!4d139.76
    /[@](-?\d+\.\d+),(-?\d+\.\d+)/,            // /@35.68,139.76,15z
    /[?&](?:q|query|ll|center|daddr)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/, // ?q=35.68,139.76
  ];
  for (const pattern of patterns) {
    const found = mapUrl.match(pattern);
    if (found) {
      const lat = Number(found[1]);
      const lng = Number(found[2]);
      if (isValidCoordinate(lat, lng)) return { lat, lng };
    }
  }
  return null;
}

/**
 * Googleマップの URL から地名を取り出す。`/maps/place/<名前>/@lat,lng` の形なら
 * 地名と座標が同じURLに入っているので、両者が食い違いようがない。
 * 座標だけの URL（`/maps/@lat,lng`）には地名が無いので null を返す。
 */
export function parsePlaceName(mapUrl: string): string | null {
  const found = mapUrl.match(/\/maps\/place\/([^/@?]+)/);
  if (!found) return null;
  try {
    return decodeURIComponent(found[1]).replace(/\+/g, " ").trim() || null;
  } catch {
    return null;
  }
}

/**
 * Googleマップの `?q=` から検索語を取り出す。共有の仕方によっては
 * `/maps/place/…` ではなく `?q=〒560-0036 大阪府… 大阪国際空港 (ITM)` の形で来る。
 *
 * Nominatim は住所の全体では引けず施設名なら引けることが多いので、
 * 施設名だけを先に、駄目なら全体を、の順で候補を返す。
 */
export function placeQueryCandidates(mapUrl: string): string[] {
  let raw = "";
  try {
    raw = new URL(mapUrl).searchParams.get("q") || "";
  } catch {
    return [];
  }
  if (!raw.trim()) return [];
  // 座標そのものが q= に入っている場合は検索の出番ではない。
  if (/^-?\d+\.\d+\s*,\s*-?\d+\.\d+$/.test(raw.trim())) return [];

  const tokens = raw.split(/[\s\u3000]+/).filter(Boolean).filter((token) => (
    !/^〒?\d{3}-?\d{4}$/.test(token) && !/^[（(].*[)）]$/.test(token)
  ));
  const candidates: string[] = [];
  // Googleは「住所 施設名」の順に並べるので、末尾の語が施設名であることが多い。
  const last = tokens[tokens.length - 1];
  if (last && tokens.length > 1) candidates.push(last);
  const whole = tokens.join(" ").trim();
  if (whole && whole !== last) candidates.push(whole);
  if (!candidates.length && raw.trim()) candidates.push(raw.trim());
  return candidates;
}

export type Place = { url: string; name: string; lat: number; lng: number };

/**
 * URL 1本から場所を決める。地名が URL に無ければ label で補う。
 * 座標が取れなければ場所として成立しないので null。
 */
export function resolvePlace(mapUrl: string, label = ""): Place | null {
  const coordinate = parseLatLng(mapUrl);
  if (!coordinate) return null;
  const name = parsePlaceName(mapUrl) || label.trim() || `${coordinate.lat.toFixed(4)}, ${coordinate.lng.toFixed(4)}`;
  return { url: mapUrl, name, lat: coordinate.lat, lng: coordinate.lng };
}

export function isValidCoordinate(lat: unknown, lng: unknown): boolean {
  return typeof lat === "number" && typeof lng === "number"
    && Number.isFinite(lat) && Number.isFinite(lng)
    && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
    && !(lat === 0 && lng === 0);
}

/** 予定に保存済みの座標を優先し、無ければ地図URLから拾う。 */
export function scheduleItemCoordinate(item: ScheduleItem): { lat: number; lng: number } | null {
  if (isValidCoordinate(item.lat, item.lng)) return { lat: item.lat as number, lng: item.lng as number };
  return parseLatLng(item.mapUrl);
}

export type RoutePoint = { id: string; title: string; lat: number; lng: number; day: string; time: string };
/**
 * source は経路の出どころ。"schedule" なら地点名と座標が同じ予定から来ているので
 * 必ず一致する。"settings" は旅行設定の地名と緯度経度を組み合わせた代替で、
 * 両者は個別に編集できるため一致する保証がない。表示側はこれを見て、
 * 地名と地図が食い違わないほうを選ぶ必要がある。
 */
export type TicketRoute = { points: RoutePoint[]; skipped: string[]; source: "schedule" | "settings" };

/**
 * 予定を日付・時刻順に並べて経路にする。
 * - inRoute が明示的に false のものは除外（未設定はON）
 * - 座標が取れないものは skipped に積んで画面で知らせる
 * - 同じ座標が連続したら畳む（同一場所の連投で線が潰れるのを防ぐ）
 */
export function buildTicketRoute(state: SharedState): TicketRoute {
  const skipped: string[] = [];
  const ordered = [...state.schedule.items]
    .filter((item) => item.inRoute !== false)
    .sort((a, b) => {
      const day = a.day.localeCompare(b.day);
      if (day !== 0) return day;
      const timeA = a.isTimeUnset || !a.time ? "99:99" : a.time;
      const timeB = b.isTimeUnset || !b.time ? "99:99" : b.time;
      return timeA.localeCompare(timeB);
    });

  const points: RoutePoint[] = [];
  for (const item of ordered) {
    const coordinate = scheduleItemCoordinate(item);
    if (!coordinate) {
      if (item.title.trim()) skipped.push(item.title.trim());
      continue;
    }
    const previous = points[points.length - 1];
    // 連続する同一地点は1点に畳む。往復で再訪した場合は間に別地点が入るので残る。
    if (previous && previous.lat === coordinate.lat && previous.lng === coordinate.lng) continue;
    points.push({ id: item.id, title: item.locationName?.trim() || item.title.trim() || "名称未設定", lat: coordinate.lat, lng: coordinate.lng, day: item.day, time: item.time });
  }

  // 予定に座標が1つも無いチケットは、旅行設定の出発地・目的地で最低限の線を引く。
  if (points.length < 2) {
    const settings = state.tripSettings;
    const anchors: RoutePoint[] = [];
    // URL があればそこから地名も座標も取る。URL 側が常に優先で、名前と位置が
    // 別々に古くなることがない。URL 未設定の既存データだけ旧フィールドへ落ちる。
    const origin = resolvePlace(settings.mapOriginUrl || "", settings.mapOrigin);
    const destination = resolvePlace(settings.mapDestinationUrl || "", settings.mapDestination);
    if (origin) {
      anchors.push({ id: "origin", title: origin.name, lat: origin.lat, lng: origin.lng, day: settings.startDate, time: "" });
    } else if (isValidCoordinate(settings.mapOriginLat, settings.mapOriginLng)) {
      anchors.push({ id: "origin", title: settings.mapOrigin || "出発地", lat: settings.mapOriginLat, lng: settings.mapOriginLng, day: settings.startDate, time: "" });
    }
    if (destination) {
      anchors.push({ id: "destination", title: destination.name, lat: destination.lat, lng: destination.lng, day: settings.endDate, time: "" });
    } else if (isValidCoordinate(settings.mapDestinationLat, settings.mapDestinationLng)) {
      anchors.push({ id: "destination", title: settings.mapDestination || "目的地", lat: settings.mapDestinationLat, lng: settings.mapDestinationLng, day: settings.endDate, time: "" });
    }
    if (anchors.length > points.length) return { points: anchors, skipped, source: "settings" };
  }

  return { points, skipped, source: "schedule" };
}

// ---------------------------------------------------------------------------
// 既存データの移行
// ---------------------------------------------------------------------------

export type LegacyStorage = {
  tickets?: Ticket[] | null;
  trips?: TravelProfile[] | null;
  groups?: Group[] | null;
  activeGroup?: Group | null;
  activeTripId?: string;
};

function ticketFromTrip(trip: TravelProfile, index: number): Ticket {
  return { ...trip, themeColor: defaultThemeColor(index) };
}

/**
 * 旧形式（tripShioriTrips + tripShioriGroups）からチケット一覧を作る。
 *
 * 元データは消さない。移行結果は別キーへ書くので、失敗しても旧キーから作り直せる。
 *
 * グループと旅行の対応は保存されていないため、以下の順で推測する。
 *   1. activeGroup は activeTripId の旅行に紐付いている（唯一確実に分かる対）
 *   2. 残りは名前の一致
 *   3. それでも余ったグループは、そのグループ自身の state から新しいチケットを作る
 */
export function migrateToTickets(storage: LegacyStorage): Ticket[] {
  if (storage.tickets?.length) return storage.tickets;

  const trips = Array.isArray(storage.trips) ? storage.trips : [];
  const groups = Array.isArray(storage.groups) ? storage.groups : [];
  const tickets = trips.map(ticketFromTrip);
  const linkedGroupIds = new Set<string>();

  const link = (ticket: Ticket, group: Group) => {
    ticket.groupId = group.id;
    ticket.joinCode = group.joinCode;
    ticket.readToken = group.readToken;
    ticket.editToken = group.editToken;
    linkedGroupIds.add(group.id);
  };

  const activeGroup = storage.activeGroup;
  if (activeGroup) {
    const activeTicket = tickets.find((ticket) => ticket.id === storage.activeTripId) || tickets[0];
    const known = groups.find((group) => group.id === activeGroup.id) || activeGroup;
    if (activeTicket) link(activeTicket, known);
  }

  for (const group of groups) {
    if (linkedGroupIds.has(group.id)) continue;
    const match = tickets.find((ticket) => !ticket.groupId && ticket.name === group.name);
    if (match) link(match, group);
  }

  for (const group of groups) {
    if (linkedGroupIds.has(group.id)) continue;
    // 対応する旅行が端末に無いグループ。state を持っていれば復元し、無ければ
    // 名前だけのチケットにする（開いた時にサーバーから取得する）。
    const now = new Date().toISOString();
    const ticket: Ticket = {
      id: `ticket_${group.id}`,
      name: group.name,
      createdAt: now,
      updatedAt: group.updatedAt || now,
      archived: false,
      state: (group.state as SharedState) || ({} as SharedState),
      themeColor: defaultThemeColor(tickets.length),
      groupId: group.id,
      joinCode: group.joinCode,
      readToken: group.readToken,
      editToken: group.editToken,
    };
    tickets.push(ticket);
    linkedGroupIds.add(group.id);
  }

  return tickets;
}

export function sortTickets(tickets: Ticket[], now = today()): Ticket[] {
  const rank: Record<TicketStatus, number> = { traveling: 0, planning: 1, done: 2, archived: 3 };
  return [...tickets].sort((a, b) => {
    const byStatus = rank[ticketStatus(a, now)] - rank[ticketStatus(b, now)];
    if (byStatus !== 0) return byStatus;
    return (b.state.tripSettings?.startDate || "").localeCompare(a.state.tripSettings?.startDate || "");
  });
}

// ---------------------------------------------------------------------------
// 経路の描画に使う座標列
// ---------------------------------------------------------------------------

export type Coordinates = [number, number];

/** 直線だと重なった経路を見分けられないので、地点間を緩い曲線で結ぶ。 */
export function curveBetween(origin: Coordinates, destination: Coordinates, steps = 24): Coordinates[] {
  const [startLng, startLat] = origin;
  const [endLng, endLat] = destination;
  const dx = endLng - startLng;
  const dy = endLat - startLat;
  const control: Coordinates = [(startLng + endLng) / 2 - dy * 0.16, (startLat + endLat) / 2 + dx * 0.1];
  return Array.from({ length: steps + 1 }, (_, index) => {
    const t = index / steps;
    const inverse = 1 - t;
    return [
      inverse * inverse * startLng + 2 * inverse * t * control[0] + t * t * endLng,
      inverse * inverse * startLat + 2 * inverse * t * control[1] + t * t * endLat,
    ] as Coordinates;
  });
}

/** 経路の地点を順につないだ座標列。地点が1つ以下なら線は引けないので空を返す。 */
export function routeLine(points: RoutePoint[]): Coordinates[] {
  const line: Coordinates[] = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    line.push(...curveBetween([points[index].lng, points[index].lat], [points[index + 1].lng, points[index + 1].lat]));
  }
  return line;
}

// ---------------------------------------------------------------------------
// 宿
// ---------------------------------------------------------------------------

/** その日の宿。無ければ直前の日の宿を引き継ぐ（連泊のたびに入れ直さないため）。 */
export function stayForDay(items: ScheduleItem[], day: string): ScheduleItem | null {
  const stays = items.filter((item) => item.isStay).sort((a, b) => a.day.localeCompare(b.day));
  const own = stays.find((item) => item.day === day);
  if (own) return own;
  const earlier = stays.filter((item) => item.day < day);
  return earlier[earlier.length - 1] || null;
}
