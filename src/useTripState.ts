import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { defaultAdjust, defaultChecklist, defaultNotes, defaultSchedule, defaultSettlement, defaultTripSettings } from "./data";
import { makeId, readStorage, usePersistentState } from "./lib";
import { createTicketState, defaultThemeColor, initialTickets, normalizeSharedState } from "./tickets";
import type { AdjustState, ChecklistState, Group, NotesState, ScheduleState, SettlementState, SharedState, Ticket, TripSettings } from "./types";

function resolveState<T>(current: T, next: SetStateAction<T>): T {
  return typeof next === "function" ? (next as (value: T) => T)(current) : next;
}

export function useTripState() {
  const initialTicketSet = useMemo(() => initialTickets(), []);
  const [trips, setTrips] = usePersistentState<Ticket[]>("tripShioriTickets", initialTicketSet);
  const fallbackActiveId = initialTicketSet.find((ticket) => !ticket.archived)?.id || initialTicketSet[0]?.id || "";
  const [activeTripId, setActiveTripId] = usePersistentState<string>("tripShioriActiveTrip", readStorage("tripShioriActiveTrip", fallbackActiveId));
  const [groups, setGroups] = usePersistentState<Group[]>("tripShioriGroups", readStorage<Group[]>("tripShioriGroups", []));
  const [syncStatus, setSyncStatus] = useState("ローカルに保存済み");
  const applyingRemote = useRef(false);

  const activeTicket = useMemo(() => trips.find((ticket) => ticket.id === activeTripId) || null, [activeTripId, trips]);
  const fallbackState = useMemo(() => normalizeSharedState(), []);
  const sharedState = activeTicket?.state || fallbackState;
  const { tripSettings, schedule, adjust, settlement, checklist, notes } = sharedState;

  useEffect(() => {
    if (activeTicket || !trips.length) return;
    const available = trips.find((ticket) => !ticket.archived) || trips[0];
    if (available) setActiveTripId(available.id);
  }, [activeTicket, setActiveTripId, trips]);

  const setSlice = useCallback(<K extends keyof SharedState>(key: K, next: SetStateAction<SharedState[K]>) => {
    if (!activeTripId) return;
    const now = new Date().toISOString();
    setTrips((current) => current.map((ticket) => {
      if (ticket.id !== activeTripId) return ticket;
      const value = resolveState(ticket.state[key], next);
      const state = { ...ticket.state, [key]: value };
      const name = key === "tripSettings" ? (value as TripSettings).tripName : ticket.name;
      return { ...ticket, name, updatedAt: now, state };
    }));
    setSyncStatus("ローカルに保存済み");
  }, [activeTripId, setTrips]);

  const setTripSettings = useCallback<Dispatch<SetStateAction<TripSettings>>>((next) => setSlice("tripSettings", next), [setSlice]);
  const setSchedule = useCallback<Dispatch<SetStateAction<ScheduleState>>>((next) => setSlice("schedule", next), [setSlice]);
  const setAdjust = useCallback<Dispatch<SetStateAction<AdjustState>>>((next) => setSlice("adjust", next), [setSlice]);
  const setSettlement = useCallback<Dispatch<SetStateAction<SettlementState>>>((next) => setSlice("settlement", next), [setSlice]);
  const setChecklist = useCallback<Dispatch<SetStateAction<ChecklistState>>>((next) => setSlice("checklist", next), [setSlice]);
  const setNotes = useCallback<Dispatch<SetStateAction<NotesState>>>((next) => setSlice("notes", next), [setSlice]);

  const activeGroup = useMemo<Group | null>(() => {
    if (!activeTicket?.groupId) return null;
    return groups.find((group) => group.id === activeTicket.groupId) || {
      id: activeTicket.groupId,
      name: activeTicket.name,
      joinCode: activeTicket.joinCode || "",
      readToken: activeTicket.readToken,
      editToken: activeTicket.editToken,
      updatedAt: activeTicket.updatedAt,
    };
  }, [activeTicket, groups]);

  const request = useCallback(async <T,>(path: string, init?: RequestInit): Promise<T> => {
    const headers = new Headers(init?.headers);
    if (!headers.has("content-type")) headers.set("content-type", "application/json");
    const response = await fetch(path, { ...init, headers });
    const payload = await response.json() as T & { error?: string };
    if (!response.ok) throw new Error(payload.error || "共有データを更新できませんでした。");
    return payload;
  }, []);

  const linkGroupToTicket = useCallback((ticketId: string, group: Group, state?: Partial<SharedState>) => {
    setTrips((current) => current.map((ticket) => ticket.id === ticketId ? {
      ...ticket,
      name: group.name || ticket.name,
      updatedAt: group.updatedAt || new Date().toISOString(),
      state: state ? normalizeSharedState(state) : ticket.state,
      groupId: group.id,
      joinCode: group.joinCode,
      readToken: group.readToken,
      editToken: group.editToken,
    } : ticket));
  }, [setTrips]);

  const rememberGroup = useCallback((group: Group) => {
    setGroups((current) => [...current.filter((item) => item.id !== group.id), group]);
  }, [setGroups]);

  const createTrip = useCallback(async (input: { name: string; themeColor?: string; startDate: string; endDate: string; origin: string; destination: string }) => {
    const now = new Date().toISOString();
    const state = createTicketState(input.name, input.startDate, input.endDate, input.origin, input.destination);
    const ticket: Ticket = {
      id: makeId("trip"),
      name: state.tripSettings.tripName,
      createdAt: now,
      updatedAt: now,
      archived: false,
      state,
      themeColor: input.themeColor || defaultThemeColor(trips.length),
    };
    setTrips((current) => [...current, ticket]);
    setActiveTripId(ticket.id);
    setSyncStatus("新しいチケットを作成しました");
    return ticket.id;
  }, [setActiveTripId, setTrips, trips.length]);

  const switchTrip = useCallback(async (id: string) => {
    if (!trips.some((ticket) => ticket.id === id)) return;
    setActiveTripId(id);
    setSyncStatus("チケットを切り替えました");
  }, [setActiveTripId, trips]);

  const archiveTrip = useCallback(async (id: string) => {
    setTrips((current) => current.map((ticket) => ticket.id === id ? { ...ticket, archived: true, updatedAt: new Date().toISOString() } : ticket));
    if (id === activeTripId) {
      const next = trips.find((ticket) => ticket.id !== id && !ticket.archived);
      setActiveTripId(next?.id || "");
    }
  }, [activeTripId, setActiveTripId, setTrips, trips]);

  const restoreTrip = useCallback((id: string) => {
    setTrips((current) => current.map((ticket) => ticket.id === id ? { ...ticket, archived: false, updatedAt: new Date().toISOString() } : ticket));
  }, [setTrips]);

  const setTicketTheme = useCallback((id: string, themeColor: string) => {
    setTrips((current) => current.map((ticket) => ticket.id === id ? { ...ticket, themeColor, updatedAt: new Date().toISOString() } : ticket));
  }, [setTrips]);

  const createGroup = useCallback(async (name: string) => {
    if (!activeTripId) throw new Error("先にチケットを開いてください。");
    setSyncStatus("グループを作成中...");
    const result = await request<{ group: Group }>("/api/groups", { method: "POST", body: JSON.stringify({ name, state: sharedState }) });
    rememberGroup(result.group);
    linkGroupToTicket(activeTripId, result.group);
    setSyncStatus("このチケットを共有にしました");
  }, [activeTripId, linkGroupToTicket, rememberGroup, request, sharedState]);

  const joinGroup = useCallback(async (joinCode: string) => {
    setSyncStatus("チケットに参加中...");
    const result = await request<{ group: Group }>("/api/groups/join", { method: "POST", body: JSON.stringify({ joinCode }) });
    const group = result.group;
    const existing = trips.find((ticket) => ticket.groupId === group.id);
    let ticketId = existing?.id;
    if (existing) {
      linkGroupToTicket(existing.id, group, group.state);
    } else {
      const now = new Date().toISOString();
      const state = normalizeSharedState(group.state);
      ticketId = makeId("trip");
      const ticket: Ticket = {
        id: ticketId,
        name: group.name,
        createdAt: now,
        updatedAt: group.updatedAt || now,
        archived: false,
        state,
        themeColor: defaultThemeColor(trips.length),
        groupId: group.id,
        joinCode: group.joinCode,
        readToken: group.readToken,
        editToken: group.editToken,
      };
      setTrips((current) => [...current, ticket]);
    }
    rememberGroup(group);
    if (ticketId) setActiveTripId(ticketId);
    setSyncStatus("チケットに参加しました");
    return ticketId;
  }, [linkGroupToTicket, rememberGroup, request, setActiveTripId, setTrips, trips]);

  const refreshGroup = useCallback(async (target = activeGroup, ticketId = activeTripId) => {
    if (!target || !ticketId) return;
    setSyncStatus("共有データを更新中...");
    const result = await request<{ group: Group }>(`/api/groups/${target.id}?token=${encodeURIComponent(target.editToken || target.readToken || "")}`);
    applyingRemote.current = true;
    const group = { ...result.group, readToken: target.readToken, editToken: target.editToken };
    rememberGroup(group);
    linkGroupToTicket(ticketId, group, group.state);
    window.setTimeout(() => { applyingRemote.current = false; }, 80);
    setSyncStatus("最新の状態です");
  }, [activeGroup, activeTripId, linkGroupToTicket, rememberGroup, request]);

  const switchGroup = useCallback(async (id: string) => {
    const ticket = trips.find((entry) => entry.groupId === id);
    if (ticket) {
      await switchTrip(ticket.id);
      const group = groups.find((entry) => entry.id === id);
      if (group) await refreshGroup(group, ticket.id);
    }
  }, [groups, refreshGroup, switchTrip, trips]);

  useEffect(() => {
    if (!activeGroup || applyingRemote.current || !activeGroup.editToken) return;
    setSyncStatus("変更を保存中...");
    const timer = window.setTimeout(async () => {
      try {
        await request(`/api/groups/${activeGroup.id}`, {
          method: "PUT",
          headers: { authorization: `Bearer ${activeGroup.editToken}` },
          body: JSON.stringify({ state: sharedState }),
        });
        setSyncStatus("共有済み");
      } catch (error) {
        setSyncStatus(error instanceof Error ? error.message : "共有に失敗しました");
      }
    }, 900);
    return () => window.clearTimeout(timer);
  }, [activeGroup, request, sharedState]);

  return {
    tripSettings, setTripSettings,
    schedule, setSchedule,
    adjust, setAdjust,
    settlement, setSettlement,
    checklist, setChecklist,
    notes, setNotes,
    groups, activeGroup, syncStatus,
    trips, activeTripId, activeTicket, createTrip, switchTrip, archiveTrip, restoreTrip, setTicketTheme,
    createGroup, joinGroup, refreshGroup, switchGroup,
  };
}
