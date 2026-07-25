import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createDefaultSharedState,
  defaultAdjust,
  defaultAlbum,
  defaultChecklist,
  defaultHistory,
  defaultNotes,
  defaultReservations,
  defaultSchedule,
  defaultSettlement,
  defaultTripSettings,
} from "./data";
import { makeId, readStorage, usePersistentState } from "./lib";
import { defaultThemeColor, migrateToTickets } from "./tickets";
import type {
  AdjustState,
  AccountGroup,
  AccountUser,
  AlbumState,
  ChecklistState,
  Group,
  HistoryState,
  NotesState,
  ReservationsState,
  SavePhase,
  ScheduleState,
  SettlementState,
  SharedState,
  Ticket,
  TravelProfile,
  TripSettings,
} from "./types";

function initialObject<T extends object>(key: string, fallback: T): T {
  return { ...fallback, ...readStorage<Partial<T>>(key, {}) } as T;
}

export function useTripState() {
  const [tripSettings, setTripSettings] = usePersistentState<TripSettings>("tripShioriSettings", initialObject("tripShioriSettings", defaultTripSettings));
  const [schedule, setSchedule] = usePersistentState<ScheduleState>("tripShioriSchedule", initialObject("tripShioriSchedule", defaultSchedule));
  const [adjust, setAdjust] = usePersistentState<AdjustState>("tripShioriAdjust", initialObject("tripShioriAdjust", defaultAdjust));
  const [settlement, setSettlement] = usePersistentState<SettlementState>("tripShioriSettlement", initialObject("tripShioriSettlement", defaultSettlement));
  const [checklist, setChecklist] = usePersistentState<ChecklistState>("tripShioriChecklist", initialObject("tripShioriChecklist", defaultChecklist));
  const [notes, setNotes] = usePersistentState<NotesState>("tripShioriSharedNotes", initialObject("tripShioriSharedNotes", defaultNotes));
  const [reservations, setReservations] = usePersistentState<ReservationsState>("tripShioriReservations", initialObject("tripShioriReservations", defaultReservations));
  const [album, setAlbum] = usePersistentState<AlbumState>("tripShioriAlbum", initialObject("tripShioriAlbum", defaultAlbum));
  const [history, setHistory] = usePersistentState<HistoryState>("tripShioriHistory", initialObject("tripShioriHistory", defaultHistory));
  const [groups, setGroups] = usePersistentState<Group[]>("tripShioriGroups", readStorage<Group[]>("tripShioriGroups", []));
  const [helpOpen, setHelpOpen] = usePersistentState<boolean>("tripShioriHelpOpen", readStorage("tripShioriHelpOpen", true));
  const [accountUser, setAccountUser] = useState<AccountUser | null>(null);
  const [accountGroups, setAccountGroups] = useState<AccountGroup[]>([]);
  const [activeGroup, setActiveGroup] = useState<Group | null>(() => readStorage<Group | null>("tripShioriGroup", null));
  // 旧 tripShioriTrips は消さずに残す。移行結果だけ tripShioriTickets へ書くので、
  // 何かあっても旧キーからやり直せる。
  const [trips, setTrips] = usePersistentState<Ticket[]>("tripShioriTickets", migrateToTickets({
    tickets: readStorage<Ticket[] | null>("tripShioriTickets", null),
    trips: readStorage<TravelProfile[]>("tripShioriTrips", []),
    groups: readStorage<Group[]>("tripShioriGroups", []),
    activeGroup: readStorage<Group | null>("tripShioriGroup", null),
    activeTripId: readStorage("tripShioriActiveTrip", ""),
  }));
  const [activeTripId, setActiveTripId] = usePersistentState<string>("tripShioriActiveTrip", readStorage("tripShioriActiveTrip", ""));
  const [syncStatus, setSyncStatus] = useState("ローカルに保存済み");
  const [savePhase, setSavePhase] = useState<SavePhase>("saved");
  const [lastSavedAt, setLastSavedAt] = useState(() => readStorage("tripShioriLastSavedAt", ""));
  const applyingRemote = useRef(false);
  const applyingTrip = useRef(false);
  const sectionRef = useRef<Record<string, string> | null>(null);
  const groupVersionRef = useRef(activeGroup?.updatedAt || "");
  const groupFingerprintRef = useRef("");
  const previousUndoStateRef = useRef<SharedState | null>(null);
  const undoStackRef = useRef<SharedState[]>([]);
  const [canUndo, setCanUndo] = useState(false);

  const sharedState = useMemo<SharedState>(() => ({
    tripSettings,
    schedule,
    adjust,
    settlement,
    checklist,
    notes,
    reservations,
    album,
    history,
  }), [adjust, album, checklist, history, notes, reservations, schedule, settlement, tripSettings]);

  const remoteSharedState = useMemo<SharedState>(() => ({
    ...sharedState,
    reservations: {
      items: reservations.items.map((item) => ({ ...item, reference: "", attachmentName: "", attachmentData: "" })),
    },
  }), [reservations.items, sharedState]);

  const applySharedState = useCallback((state?: Partial<SharedState>) => {
    if (!state) return;
    applyingRemote.current = true;
    if (state.tripSettings) setTripSettings({ ...defaultTripSettings, ...state.tripSettings });
    if (state.schedule) setSchedule({ ...defaultSchedule, ...state.schedule });
    if (state.adjust) setAdjust({ ...defaultAdjust, ...state.adjust });
    if (state.settlement) setSettlement({ ...defaultSettlement, ...state.settlement });
    if (state.checklist) setChecklist({ ...defaultChecklist, ...state.checklist });
    if (state.notes) setNotes({ ...defaultNotes, ...state.notes });
    setReservations((current) => {
      if (!state.reservations) return defaultReservations;
      const incoming = Array.isArray(state.reservations.items) ? state.reservations.items : [];
      return {
        ...defaultReservations,
        ...state.reservations,
        items: incoming.map((item) => {
          const local = current.items.find((entry) => entry.id === item.id);
          return { ...item, reference: local?.reference || "", attachmentName: local?.attachmentName || "", attachmentData: local?.attachmentData || "" };
        }),
      };
    });
    setAlbum(state.album ? { ...defaultAlbum, ...state.album } : defaultAlbum);
    setHistory(state.history ? { ...defaultHistory, ...state.history } : defaultHistory);
    window.setTimeout(() => { applyingRemote.current = false; }, 120);
  }, [setAdjust, setAlbum, setChecklist, setHistory, setNotes, setReservations, setSchedule, setSettlement, setTripSettings]);

  useEffect(() => {
    const onStorage = (event: Event) => {
      const detail = (event as CustomEvent<{ phase: SavePhase; at?: string; message?: string }>).detail;
      if (!detail) return;
      if (!activeGroup) setSavePhase(detail.phase);
      if (detail.phase === "error" && detail.message) setSyncStatus(detail.message);
      if (detail.at) {
        setLastSavedAt(detail.at);
        try { localStorage.setItem("tripShioriLastSavedAt", JSON.stringify(detail.at)); } catch { /* storage status already reports the error */ }
      }
    };
    window.addEventListener("trip-storage", onStorage);
    return () => window.removeEventListener("trip-storage", onStorage);
  }, [activeGroup]);

  // 初期チケットは作らない。1枚も無い状態を正規の状態として扱い、
  // 一覧では空状態を見せる。ここで自動生成すると、初回のユーザーに
  // 身に覚えのない旅行が1件出てしまう。

  const activeTicket = useMemo(() => trips.find((trip) => trip.id === activeTripId) || null, [activeTripId, trips]);

  useEffect(() => {
    if (!activeTripId || applyingTrip.current || applyingRemote.current) return;
    const timer = window.setTimeout(() => {
      const now = new Date().toISOString();
      setTrips((current) => current.map((trip) => trip.id === activeTripId
        ? { ...trip, name: tripSettings.tripName, updatedAt: now, state: sharedState }
        : trip));
    }, 500);
    return () => window.clearTimeout(timer);
  }, [activeTripId, setTrips, sharedState, tripSettings.tripName]);

  const sectionSnapshot = useMemo(() => ({
    "旅行設定": JSON.stringify(tripSettings),
    "予定": JSON.stringify(schedule),
    "予算": JSON.stringify(adjust),
    "メンバー・支払い": JSON.stringify(settlement),
    "持ち物": JSON.stringify(checklist),
    "共有メモ": JSON.stringify(notes),
    "予約情報": JSON.stringify(reservations),
    "アルバム": JSON.stringify(album.items.map(({ dataUrl: _dataUrl, ...photo }) => photo)),
  }), [adjust, album.items, checklist, notes, reservations, schedule, settlement, tripSettings]);

  useEffect(() => {
    if (!sectionRef.current) { sectionRef.current = sectionSnapshot; previousUndoStateRef.current = sharedState; return; }
    const changed = (Object.keys(sectionSnapshot) as Array<keyof typeof sectionSnapshot>).filter((key) => sectionRef.current?.[key] !== sectionSnapshot[key]);
    const previousState = previousUndoStateRef.current;
    sectionRef.current = sectionSnapshot;
    previousUndoStateRef.current = sharedState;
    if (!changed.length || applyingRemote.current || applyingTrip.current) return;
    if (previousState) {
      undoStackRef.current = [...undoStackRef.current.slice(-7), previousState];
      setCanUndo(true);
    }
    const timer = window.setTimeout(() => {
      setHistory((current) => ({ items: [{ id: makeId("history"), text: `${changed.join("・")}を更新`, createdAt: new Date().toISOString(), source: "この端末" }, ...current.items].slice(0, 40) }));
    }, 800);
    return () => window.clearTimeout(timer);
  }, [sectionSnapshot, setHistory, sharedState]);

  const undoLastChange = useCallback(() => {
    const snapshot = undoStackRef.current.pop();
    if (!snapshot) return;
    applyingTrip.current = true;
    applySharedState(snapshot);
    setCanUndo(undoStackRef.current.length > 0);
    window.setTimeout(() => {
      setHistory((current) => ({ items: [{ id: makeId("history"), text: "直前の変更を元に戻しました", createdAt: new Date().toISOString(), source: "この端末" }, ...current.items].slice(0, 40) }));
      applyingTrip.current = false;
    }, 160);
  }, [applySharedState, setHistory]);

  /**
   * チケットを切り替える。共有先はチケットに紐付いたグループへ必ず差し替える。
   * 以前は activeGroup がチケットと独立していたため、切り替え後の編集が
   * 別チケットの内容で前のグループを上書きしていた。
   */
  const switchTrip = useCallback(async (id: string) => {
    const target = trips.find((trip) => trip.id === id);
    if (!target || target.id === activeTripId) return;
    applyingTrip.current = true;
    setTrips((current) => current.map((trip) => trip.id === activeTripId ? { ...trip, name: tripSettings.tripName, updatedAt: new Date().toISOString(), state: sharedState } : trip));
    setActiveTripId(target.id);
    applySharedState(target.state);
    const linked = target.groupId
      ? { id: target.groupId, name: target.name, joinCode: target.joinCode || "", readToken: target.readToken, editToken: target.editToken, updatedAt: target.updatedAt }
      : null;
    groupVersionRef.current = linked?.updatedAt || "";
    // 切り替え直後の同期を止めるため、指紋を新しい状態で先に埋める。
    groupFingerprintRef.current = linked ? JSON.stringify({ ...target.state, reservations: { items: (target.state.reservations?.items || []).map((item) => ({ ...item, reference: "", attachmentName: "", attachmentData: "" })) } }) : "";
    setActiveGroup(linked);
    if (linked) localStorage.setItem("tripShioriGroup", JSON.stringify(linked));
    setSyncStatus(linked ? `${target.name}に切り替えました（共有中）` : `${target.name}に切り替えました`);
    window.setTimeout(() => { applyingTrip.current = false; }, 180);
  }, [activeTripId, applySharedState, setActiveTripId, setTrips, sharedState, tripSettings.tripName, trips]);

  const createTrip = useCallback(async (name: string, themeColor?: string, places?: { startDate?: string; endDate?: string; originUrl?: string; originLabel?: string; originLat?: number; originLng?: number; destinationUrl?: string; destinationLabel?: string; destinationLat?: number; destinationLng?: number }) => {
    const now = new Date().toISOString();
    const state = createDefaultSharedState(name.trim() || "新しい旅行");
    const start = new Date();
    const end = new Date(start);
    end.setDate(end.getDate() + 2);
    const date = (value: Date) => [value.getFullYear(), String(value.getMonth() + 1).padStart(2, "0"), String(value.getDate()).padStart(2, "0")].join("-");
    const startDate = places?.startDate || date(start);
    const endDate = places?.endDate || date(end);
    state.tripSettings = { ...state.tripSettings, startDate, endDate, dateLabel: `${startDate.replaceAll("-", ".")} - ${endDate.slice(5).replace("-", ".")}`, routeLabel: "出発地から目的地へ", outboundLabel: "未設定", returnLabel: "未設定", hotelName: "未設定", hotelAddress: "", mapOriginUrl: places?.originUrl || "", mapDestinationUrl: places?.destinationUrl || "", mapOrigin: places?.originLabel || "", mapDestination: places?.destinationLabel || "", mapOriginLat: places?.originLat ?? 0, mapOriginLng: places?.originLng ?? 0, mapDestinationLat: places?.destinationLat ?? 0, mapDestinationLng: places?.destinationLng ?? 0, mapNote: "", originCode: "", destinationCode: "" };
    state.schedule = { activeDay: state.tripSettings.startDate, items: [] };
    const trip: Ticket = { id: makeId("trip"), name: state.tripSettings.tripName, createdAt: now, updatedAt: now, archived: false, state, themeColor: themeColor || defaultThemeColor(trips.length) };
    applyingTrip.current = true;
    setTrips((current) => [...current, trip]);
    setActiveTripId(trip.id);
    applySharedState(state);
    // 新しいチケットはまだ共有していない。前のチケットのグループへ書き込まないよう外す。
    setActiveGroup(null);
    groupFingerprintRef.current = "";
    groupVersionRef.current = "";
    localStorage.removeItem("tripShioriGroup");
    setSyncStatus("新しいチケットを作成しました");
    window.setTimeout(() => { applyingTrip.current = false; }, 180);
    return trip.id;
  }, [applySharedState, setActiveTripId, setTrips, trips.length]);

  const setTicketTheme = useCallback((id: string, themeColor: string) => {
    setTrips((current) => current.map((trip) => trip.id === id ? { ...trip, themeColor } : trip));
  }, [setTrips]);

  const completeTrip = useCallback((id: string, done: boolean) => {
    setTrips((current) => current.map((trip) => trip.id === id
      ? { ...trip, completedAt: done ? new Date().toISOString() : undefined, updatedAt: new Date().toISOString() }
      : trip));
  }, [setTrips]);

  /** チケットを開いていない状態へ戻す。共有先も外さないと次の編集が別チケットへ飛ぶ。 */
  const clearActiveTicket = useCallback(() => {
    setActiveTripId("");
    setActiveGroup(null);
    groupFingerprintRef.current = "";
    groupVersionRef.current = "";
    localStorage.removeItem("tripShioriGroup");
  }, [setActiveTripId]);

  // 0枚を正規の状態にしたので、最後の1枚もアーカイブできる。
  const archiveTrip = useCallback(async (id: string) => {
    setTrips((current) => current.map((trip) => trip.id === id ? { ...trip, archived: true, updatedAt: new Date().toISOString() } : trip));
    if (id !== activeTripId) return;
    const available = trips.filter((trip) => trip.id !== id && !trip.archived);
    if (available.length) await switchTrip(available[0].id);
    else clearActiveTicket();
  }, [activeTripId, clearActiveTicket, setTrips, switchTrip, trips]);

  /**
   * チケットをこの端末から削除する。共有グループのサーバー側データには触らない。
   * 参加コードを知っていれば、あとから同じグループへ入り直せる。
   */
  const deleteTrip = useCallback(async (id: string) => {
    setTrips((current) => current.filter((trip) => trip.id !== id));
    if (id !== activeTripId) return;
    const available = trips.filter((trip) => trip.id !== id && !trip.archived);
    if (available.length) await switchTrip(available[0].id);
    else clearActiveTicket();
  }, [activeTripId, clearActiveTicket, setTrips, switchTrip, trips]);

  const restoreTrip = useCallback((id: string) => {
    setTrips((current) => current.map((trip) => trip.id === id ? { ...trip, archived: false, updatedAt: new Date().toISOString() } : trip));
  }, [setTrips]);

  const rememberGroup = useCallback((group: Group) => {
    groupVersionRef.current = group.updatedAt || "";
    setGroups((current) => [...current.filter((item) => item.id !== group.id), group]);
    setActiveGroup(group);
    localStorage.setItem("tripShioriGroup", JSON.stringify(group));
  }, [setGroups]);

  const request = useCallback(async <T,>(path: string, init?: RequestInit): Promise<T> => {
    const headers = new Headers(init?.headers);
    if (!headers.has("content-type")) headers.set("content-type", "application/json");
    const response = await fetch(path, { ...init, headers, credentials: "same-origin" });
    const payload = await response.json() as T & { error?: string };
    if (!response.ok) throw new Error(payload.error || "共有データを更新できませんでした。");
    return payload;
  }, []);

  const refreshAccount = useCallback(async () => {
    try {
      const me = await request<{ user: AccountUser }>("/api/auth/me");
      setAccountUser(me.user);
      for (const group of groups) {
        if (!group.editToken) continue;
        try {
          await request(`/api/groups/${group.id}/claim`, { method: "POST", headers: { authorization: `Bearer ${group.editToken}` } });
        } catch { /* A failed claim does not break device-token access. */ }
      }
      const result = await request<{ groups: AccountGroup[] }>("/api/groups");
      setAccountGroups(result.groups);
    } catch {
      setAccountUser(null);
      setAccountGroups([]);
    }
  }, [groups, request]);

  useEffect(() => { void refreshAccount(); }, [refreshAccount]);

  const loginWithGoogle = useCallback(() => { window.location.assign("/api/auth/google"); }, []);
  const logout = useCallback(async () => {
    await request("/api/auth/logout", { method: "POST" });
    setAccountUser(null);
    setAccountGroups([]);
  }, [request]);

  /** アカウントに紐付いたグループを、この端末のチケットとして復元する。 */
  const restoreAccountGroup = useCallback(async (id: string) => {
    const known = accountGroups.find((group) => group.id === id);
    if (!known) return;
    const result = await request<{ group: Group }>(`/api/groups/${id}`);
    const restored = { ...result.group, editToken: "" };
    const existing = trips.find((trip) => trip.groupId === id);
    const now = new Date().toISOString();
    const ticketId = existing?.id || makeId("trip");
    if (!existing) {
      const state = { ...createDefaultSharedState(restored.name), ...(restored.state as SharedState) };
      setTrips((current) => [...current, {
        id: ticketId, name: restored.name, createdAt: now, updatedAt: now, archived: false, state,
        themeColor: defaultThemeColor(current.length),
        groupId: restored.id, joinCode: restored.joinCode, readToken: restored.readToken, editToken: restored.editToken,
      }]);
    }
    applyingTrip.current = true;
    setActiveTripId(ticketId);
    groupFingerprintRef.current = JSON.stringify(restored.state || {});
    applySharedState(restored.state);
    rememberGroup(restored);
    setSavePhase("synced");
    setSyncStatus("アカウントからチケットを復元しました");
    window.setTimeout(() => { applyingTrip.current = false; }, 180);
  }, [accountGroups, applySharedState, rememberGroup, request, setActiveTripId, setTrips, trips]);

  /** 現在のチケットへグループを紐付ける。チケットとグループの対応はここでだけ作られる。 */
  const linkGroupToTicket = useCallback((ticketId: string, group: Group) => {
    setTrips((current) => current.map((trip) => trip.id === ticketId
      ? { ...trip, groupId: group.id, joinCode: group.joinCode, readToken: group.readToken, editToken: group.editToken }
      : trip));
  }, [setTrips]);

  const createGroup = useCallback(async (name: string) => {
    setSavePhase("syncing"); setSyncStatus("共有を準備中...");
    const result = await request<{ group: Group }>("/api/groups", { method: "POST", body: JSON.stringify({ name, state: remoteSharedState }) });
    groupFingerprintRef.current = JSON.stringify(remoteSharedState);
    rememberGroup(result.group);
    if (activeTripId) linkGroupToTicket(activeTripId, result.group);
    setSavePhase("synced"); setSyncStatus("このチケットを共有にしました");
  }, [activeTripId, linkGroupToTicket, rememberGroup, remoteSharedState, request]);

  /**
   * 参加コードで参加する。参加は「新しいチケットが1枚増える」操作なので、
   * 開いているチケットを上書きせず、新しいチケットを作ってそこへ紐付ける。
   */
  const joinGroup = useCallback(async (joinCode: string) => {
    setSavePhase("syncing"); setSyncStatus("チケットに参加中...");
    const result = await request<{ group: Group }>("/api/groups/join", { method: "POST", body: JSON.stringify({ joinCode }) });
    const group = result.group;
    const existing = trips.find((trip) => trip.groupId === group.id);
    const now = new Date().toISOString();
    const ticketId = existing?.id || makeId("trip");
    if (!existing) {
      const state = { ...createDefaultSharedState(group.name), ...(group.state as SharedState) };
      setTrips((current) => [...current, {
        id: ticketId, name: group.name, createdAt: now, updatedAt: now, archived: false, state,
        themeColor: defaultThemeColor(current.length),
        groupId: group.id, joinCode: group.joinCode, readToken: group.readToken, editToken: group.editToken,
      }]);
    } else {
      linkGroupToTicket(existing.id, group);
    }
    applyingTrip.current = true;
    setActiveTripId(ticketId);
    groupFingerprintRef.current = JSON.stringify(group.state || {});
    applySharedState(group.state);
    rememberGroup(group);
    setSavePhase("synced"); setSyncStatus("チケットに参加しました");
    window.setTimeout(() => { applyingTrip.current = false; }, 180);
  }, [applySharedState, linkGroupToTicket, rememberGroup, request, setActiveTripId, setTrips, trips]);

  const refreshGroup = useCallback(async (target = activeGroup) => {
    if (!target) return;
    setSavePhase("syncing"); setSyncStatus("共有データを更新中...");
    const result = await request<{ group: Group }>(`/api/groups/${target.id}`, {
      headers: { authorization: `Bearer ${target.readToken || target.editToken}` },
    });
    const refreshed = { ...result.group, readToken: target.readToken, editToken: target.editToken };
    groupFingerprintRef.current = JSON.stringify(refreshed.state || {}); applySharedState(refreshed.state); rememberGroup(refreshed); setSavePhase("synced"); setSyncStatus("最新の状態です");
  }, [activeGroup, applySharedState, rememberGroup, request]);

  const switchGroup = useCallback(async (id: string) => {
    const group = groups.find((item) => item.id === id);
    if (group) await refreshGroup(group);
  }, [groups, refreshGroup]);

  useEffect(() => {
    if (!activeGroup) { groupFingerprintRef.current = ""; return; }
    const fingerprint = JSON.stringify(remoteSharedState);
    if (!groupFingerprintRef.current) { groupFingerprintRef.current = fingerprint; return; }
    if (fingerprint === groupFingerprintRef.current || applyingRemote.current || applyingTrip.current) return;
    setSavePhase("syncing"); setSyncStatus("変更を共有中...");
    const timer = window.setTimeout(async () => {
      try {
        const result = await request<{ group: Group }>(`/api/groups/${activeGroup.id}`, {
          method: "PUT",
          headers: { authorization: `Bearer ${activeGroup.editToken || ""}` },
          body: JSON.stringify({ state: remoteSharedState, expectedUpdatedAt: groupVersionRef.current }),
        });
        if (result.group?.updatedAt) groupVersionRef.current = result.group.updatedAt;
        groupFingerprintRef.current = fingerprint;
        setSavePhase("synced"); setSyncStatus("共有済み"); setLastSavedAt(new Date().toISOString());
      } catch (error) {
        setSavePhase("error"); setSyncStatus(error instanceof Error ? error.message : "共有に失敗しました");
      }
    }, 900);
    return () => window.clearTimeout(timer);
  }, [activeGroup, remoteSharedState, request]);

  const retrySave = useCallback(() => {
    try {
      localStorage.setItem("tripShioriSettings", JSON.stringify(tripSettings));
      localStorage.setItem("tripShioriSchedule", JSON.stringify(schedule));
      localStorage.setItem("tripShioriAdjust", JSON.stringify(adjust));
      localStorage.setItem("tripShioriSettlement", JSON.stringify(settlement));
      localStorage.setItem("tripShioriChecklist", JSON.stringify(checklist));
      localStorage.setItem("tripShioriSharedNotes", JSON.stringify(notes));
      localStorage.setItem("tripShioriReservations", JSON.stringify(reservations));
      localStorage.setItem("tripShioriAlbum", JSON.stringify(album));
      setSavePhase("saved"); setLastSavedAt(new Date().toISOString());
    } catch { setSavePhase("error"); }
  }, [adjust, album, checklist, notes, reservations, schedule, settlement, tripSettings]);

  return {
    tripSettings, setTripSettings,
    schedule, setSchedule,
    adjust, setAdjust,
    settlement, setSettlement,
    checklist, setChecklist,
    notes, setNotes,
    reservations, setReservations,
    album, setAlbum,
    history, setHistory,
    canUndo, undoLastChange,
    groups, activeGroup, syncStatus,
    helpOpen, setHelpOpen,
    accountUser, accountGroups, refreshAccount, loginWithGoogle, logout, restoreAccountGroup,
    savePhase, lastSavedAt, retrySave,
    trips, activeTripId, activeTicket, createTrip, switchTrip, archiveTrip, restoreTrip, deleteTrip,
    setTicketTheme, completeTrip,
    createGroup, joinGroup, refreshGroup, switchGroup,
  };
}
