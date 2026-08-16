import type { SharedState, Ticket } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function mergeStoredValue<T>(fallback: T, stored: unknown): T {
  if (Array.isArray(fallback)) return (Array.isArray(stored) ? stored : fallback) as T;
  if (isRecord(fallback)) {
    const source = isRecord(stored) ? stored : {};
    const merged: Record<string, unknown> = { ...source };
    for (const [key, defaultValue] of Object.entries(fallback)) {
      merged[key] = mergeStoredValue(defaultValue, source[key]);
    }
    return merged as T;
  }
  return (typeof stored === typeof fallback ? stored : fallback) as T;
}

/** 旧版・破損データを現在のスキーマへ寄せ、起動時の空画面を防ぐ。 */
export function normalizeStoredTickets(
  value: unknown,
  createState: (name: string) => SharedState,
  themeColor: (index: number) => string,
): Ticket[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((stored, index) => {
    const name = typeof stored.name === "string" && stored.name.trim() ? stored.name : "旅のしおり";
    const fallback: Ticket = {
      id: `recovered-${index}`,
      name,
      createdAt: "",
      updatedAt: "",
      archived: false,
      state: createState(name),
      themeColor: themeColor(index),
    };
    return mergeStoredValue(fallback, stored);
  });
}
