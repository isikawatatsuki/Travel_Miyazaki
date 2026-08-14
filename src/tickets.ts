import { defaultAdjust, defaultChecklist, defaultNotes, defaultSchedule, defaultSettlement, defaultTripSettings } from "./data";
import { makeId, readStorage } from "./lib";
import type { Group, MapLocation, ScheduleState, SharedState, Ticket, TicketStatus, TripSettings } from "./types";

export const TICKET_COLORS = ["#e8735f", "#2f9e8f", "#6d83c9", "#d9853b", "#b5679a", "#4f8f5b"];

export function defaultThemeColor(seed: number) {
  return TICKET_COLORS[Math.abs(seed) % TICKET_COLORS.length];
}

function today() {
  const now = new Date();
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-");
}

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

export function countdownLabel(ticket: Ticket, now = today()) {
  const status = ticketStatus(ticket, now);
  if (status === "archived") return "アーカイブ済み";
  if (status === "done") return "旅行完了";
  if (status === "traveling") return "旅行中";
  const from = Date.parse(`${now}T00:00:00Z`);
  const to = Date.parse(`${ticket.state.tripSettings.startDate}T00:00:00Z`);
  if (Number.isNaN(from) || Number.isNaN(to)) return "日程未定";
  const days = Math.round((to - from) / 86_400_000);
  return days === 0 ? "いよいよ今日" : `あと${days}日`;
}

function locationFromLegacy(value: Partial<TripSettings> & Record<string, unknown>, key: "mapOrigin" | "mapDestination" | "hotel"): MapLocation {
  const modernKey = `${key}Location` as keyof TripSettings;
  const modern = value[modernKey] as MapLocation | undefined;
  if (modern && Number.isFinite(modern.longitude) && Number.isFinite(modern.latitude)) return modern;
  const latitude = Number(value[`${key}Lat`]);
  const longitude = Number(value[`${key}Lng`]);
  const fallback = key === "mapOrigin" ? defaultTripSettings.mapOriginLocation : key === "mapDestination" ? defaultTripSettings.mapDestinationLocation : defaultTripSettings.hotelLocation;
  return Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude } : fallback;
}

export function normalizeSharedState(value?: Partial<SharedState>): SharedState {
  const rawSettings = (value?.tripSettings || {}) as Partial<TripSettings> & Record<string, unknown>;
  const tripSettings: TripSettings = {
    ...defaultTripSettings,
    ...rawSettings,
    mapOriginLocation: locationFromLegacy(rawSettings, "mapOrigin"),
    mapDestinationLocation: locationFromLegacy(rawSettings, "mapDestination"),
    hotelLocation: locationFromLegacy(rawSettings, "hotel"),
  };
  const rawSchedule = value?.schedule as Partial<ScheduleState> | undefined;
  const rawItems = ((value?.schedule as unknown as { items?: Array<Record<string, unknown>> } | undefined)?.items
    || defaultSchedule.items as unknown as Array<Record<string, unknown>>);
  const schedule: ScheduleState = {
    ...defaultSchedule,
    ...rawSchedule,
    items: rawItems.map((item) => {
      const latitude = Number(item.lat);
      const longitude = Number(item.lng);
      return {
        ...item,
        id: String(item.id || makeId("schedule")),
        day: String(item.day || tripSettings.startDate),
        time: String(item.time || ""),
        title: String(item.title || ""),
        memo: String(item.memo || ""),
        isTimeUnset: Boolean(item.isTimeUnset),
        locationLabel: item.locationLabel ? String(item.locationLabel) : item.placeName ? String(item.placeName) : undefined,
        location: item.location as MapLocation | undefined || (Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude } : undefined),
      };
    }),
  };
  return {
    tripSettings,
    schedule,
    adjust: { ...defaultAdjust, ...value?.adjust },
    settlement: { ...defaultSettlement, ...value?.settlement },
    checklist: { ...defaultChecklist, ...value?.checklist },
    notes: { ...defaultNotes, ...value?.notes },
    spots: Array.isArray(value?.spots) ? value.spots : [],
  };
}

export function createTicketState(name: string, startDate: string, endDate: string, origin: string, destination: string): SharedState {
  const tripName = name.trim() || "新しい旅行";
  const state = normalizeSharedState();
  state.tripSettings = {
    ...state.tripSettings,
    tripName,
    startDate,
    endDate,
    dateLabel: `${startDate.replaceAll("-", ".")} - ${endDate.slice(5).replace("-", ".")}`,
    routeLabel: origin || destination ? `${origin || "出発地"}から${destination || "目的地"}へ` : "ルート未設定",
    heroRouteLabel: `${origin || "Origin"} to ${destination || "Destination"}`,
    outboundLabel: "未設定",
    returnLabel: "未設定",
    mapOrigin: origin || "出発地未設定",
    mapDestination: destination || "目的地未設定",
    hotelName: "未設定",
    hotelAddress: "",
    mapNote: "",
  };
  state.schedule = { activeDay: startDate, items: [] };
  return state;
}

function legacySharedState(): SharedState {
  return normalizeSharedState({
    tripSettings: readStorage("tripShioriSettings", defaultTripSettings),
    schedule: readStorage("tripShioriSchedule", defaultSchedule),
    adjust: readStorage("tripShioriAdjust", defaultAdjust),
    settlement: readStorage("tripShioriSettlement", defaultSettlement),
    checklist: readStorage("tripShioriChecklist", defaultChecklist),
    notes: readStorage("tripShioriSharedNotes", defaultNotes),
    spots: [],
  });
}

export function initialTickets(): Ticket[] {
  const stored = readStorage<unknown>("tripShioriTickets", null);
  if (Array.isArray(stored)) return stored.map((entry, index) => {
    const raw = entry as Partial<Ticket>;
    const now = new Date().toISOString();
    const state = normalizeSharedState(raw.state);
    return {
      id: raw.id || makeId("trip"),
      name: raw.name || state.tripSettings.tripName,
      createdAt: raw.createdAt || now,
      updatedAt: raw.updatedAt || now,
      archived: Boolean(raw.archived),
      state,
      themeColor: raw.themeColor || defaultThemeColor(index),
      completedAt: raw.completedAt,
      groupId: raw.groupId,
      joinCode: raw.joinCode,
      readToken: raw.readToken,
      editToken: raw.editToken,
    };
  });
  const state = legacySharedState();
  const now = new Date().toISOString();
  const activeGroup = readStorage<Group | null>("tripShioriGroup", null);
  return [{
    id: makeId("trip"),
    name: state.tripSettings.tripName,
    createdAt: now,
    updatedAt: now,
    archived: false,
    state,
    themeColor: defaultThemeColor(0),
    groupId: activeGroup?.id,
    joinCode: activeGroup?.joinCode,
    readToken: activeGroup?.readToken,
    editToken: activeGroup?.editToken,
  }];
}

export function sortTickets(tickets: Ticket[], now = today()) {
  const rank: Record<TicketStatus, number> = { traveling: 0, planning: 1, done: 2, archived: 3 };
  return [...tickets].sort((a, b) => {
    const status = rank[ticketStatus(a, now)] - rank[ticketStatus(b, now)];
    return status || (b.state.tripSettings.startDate || "").localeCompare(a.state.tripSettings.startDate || "");
  });
}
