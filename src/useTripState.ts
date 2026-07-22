import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { defaultAdjust, defaultChecklist, defaultNotes, defaultSchedule, defaultSettlement, defaultTripSettings } from "./data";
import { readStorage, usePersistentState } from "./lib";
import type { AdjustState, ChecklistState, Group, NotesState, ScheduleState, SettlementState, SharedState, TripSettings } from "./types";

function initialObject<T extends object>(key: string, fallback: T): T {
  return { ...fallback, ...readStorage<Partial<T>>(key, {}) } as T;
}

export function useTripState() {
  const [tripSettings, setTripSettings] = usePersistentState<TripSettings>(
    "tripShioriSettings",
    initialObject("tripShioriSettings", defaultTripSettings),
  );
  const [schedule, setSchedule] = usePersistentState<ScheduleState>(
    "tripShioriSchedule",
    initialObject("tripShioriSchedule", defaultSchedule),
  );
  const [adjust, setAdjust] = usePersistentState<AdjustState>(
    "tripShioriAdjust",
    initialObject("tripShioriAdjust", defaultAdjust),
  );
  const [settlement, setSettlement] = usePersistentState<SettlementState>(
    "tripShioriSettlement",
    initialObject("tripShioriSettlement", defaultSettlement),
  );
  const [checklist, setChecklist] = usePersistentState<ChecklistState>(
    "tripShioriChecklist",
    initialObject("tripShioriChecklist", defaultChecklist),
  );
  const [notes, setNotes] = usePersistentState<NotesState>(
    "tripShioriSharedNotes",
    initialObject("tripShioriSharedNotes", defaultNotes),
  );
  const [groups, setGroups] = usePersistentState<Group[]>(
    "tripShioriGroups",
    readStorage<Group[]>("tripShioriGroups", []),
  );
  const [activeGroup, setActiveGroup] = useState<Group | null>(() => readStorage<Group | null>("tripShioriGroup", null));
  const [syncStatus, setSyncStatus] = useState("ローカルに保存済み");
  const applyingRemote = useRef(false);

  const sharedState = useMemo<SharedState>(() => ({
    tripSettings,
    schedule,
    adjust,
    settlement,
    checklist,
    notes,
    spots: [],
  }), [adjust, checklist, notes, schedule, settlement, tripSettings]);

  const applySharedState = useCallback((state?: Partial<SharedState>) => {
    if (!state) return;
    applyingRemote.current = true;
    if (state.tripSettings) setTripSettings({ ...defaultTripSettings, ...state.tripSettings });
    if (state.schedule) setSchedule({ ...defaultSchedule, ...state.schedule });
    if (state.adjust) setAdjust({ ...defaultAdjust, ...state.adjust });
    if (state.settlement) setSettlement({ ...defaultSettlement, ...state.settlement });
    if (state.checklist) setChecklist({ ...defaultChecklist, ...state.checklist });
    if (state.notes) setNotes({ ...defaultNotes, ...state.notes });
    window.setTimeout(() => { applyingRemote.current = false; }, 50);
  }, [setAdjust, setChecklist, setNotes, setSchedule, setSettlement, setTripSettings]);

  const rememberGroup = useCallback((group: Group) => {
    setGroups((current) => [...current.filter((item) => item.id !== group.id), group]);
    setActiveGroup(group);
    localStorage.setItem("tripShioriGroup", JSON.stringify(group));
  }, [setGroups]);

  const request = useCallback(async <T,>(path: string, init?: RequestInit): Promise<T> => {
    const headers = new Headers(init?.headers);
    if (!headers.has("content-type")) headers.set("content-type", "application/json");
    const response = await fetch(path, {
      ...init,
      headers,
    });
    const payload = await response.json() as T & { error?: string };
    if (!response.ok) throw new Error(payload.error || "共有データを更新できませんでした。");
    return payload;
  }, []);

  const createGroup = useCallback(async (name: string) => {
    setSyncStatus("グループを作成中...");
    const result = await request<{ group: Group }>("/api/groups", {
      method: "POST",
      body: JSON.stringify({ name, state: sharedState }),
    });
    rememberGroup(result.group);
    setSyncStatus("グループを作成しました");
  }, [rememberGroup, request, sharedState]);

  const joinGroup = useCallback(async (joinCode: string) => {
    setSyncStatus("グループに参加中...");
    const result = await request<{ group: Group }>("/api/groups/join", {
      method: "POST",
      body: JSON.stringify({ joinCode }),
    });
    applySharedState(result.group.state);
    rememberGroup(result.group);
    setSyncStatus("共有データを読み込みました");
  }, [applySharedState, rememberGroup, request]);

  const refreshGroup = useCallback(async (target = activeGroup) => {
    if (!target) return;
    setSyncStatus("共有データを更新中...");
    const result = await request<{ group: Group }>(`/api/groups/${target.id}?token=${encodeURIComponent(target.editToken)}`);
    applySharedState(result.group.state);
    rememberGroup(result.group);
    setSyncStatus("最新の状態です");
  }, [activeGroup, applySharedState, rememberGroup, request]);

  const switchGroup = useCallback(async (id: string) => {
    const group = groups.find((item) => item.id === id);
    if (group) await refreshGroup(group);
  }, [groups, refreshGroup]);

  useEffect(() => {
    if (!activeGroup || applyingRemote.current) return;
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
    createGroup, joinGroup, refreshGroup, switchGroup,
  };
}
