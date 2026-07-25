import { useEffect, useState } from "react";

export const yen = new Intl.NumberFormat("ja-JP", {
  style: "currency",
  currency: "JPY",
  maximumFractionDigits: 0,
});

export function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function readStorage<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function usePersistentState<T>(key: string, fallback: T) {
  const [state, setState] = useState<T>(() => readStorage(key, fallback));
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("trip-storage", { detail: { phase: "saving", key } }));
    try {
      localStorage.setItem(key, JSON.stringify(state));
      window.dispatchEvent(new CustomEvent("trip-storage", { detail: { phase: "saved", key, at: new Date().toISOString() } }));
    } catch (error) {
      const message = error instanceof DOMException && error.name === "QuotaExceededError"
        ? "端末の保存容量が不足しています。写真や添付ファイルを減らしてください。"
        : "端末へ保存できませんでした。";
      window.dispatchEvent(new CustomEvent("trip-storage", { detail: { phase: "error", key, message } }));
    }
  }, [key, state]);
  return [state, setState] as const;
}

export function mapsDirections(origin: string, destination: string) {
  const params = new URLSearchParams({ api: "1", origin, destination, travelmode: "driving" });
  return `https://www.google.com/maps/dir/?${params}`;
}

export function mapsSearch(query: string) {
  const params = new URLSearchParams({ api: "1", query });
  return `https://www.google.com/maps/search/?${params}`;
}

// maps.google.com/maps?output=embed は www.google.com/maps/embed へ301し、その301応答が
// x-frame-options: SAMEORIGIN を返すためiframeが拒否される。リダイレクト後のURLを直接指す。
// ponytail: pb はGoogleの非公開形式。壊れたら Maps Embed API（要APIキー）へ切り替える
export function mapsEmbed(origin: string, destination: string) {
  const place = (value: string) => `!4m1!2s${encodeURIComponent(value)}`;
  return `https://www.google.com/maps/embed?origin=mfe&pb=!1m6!4m4${place(origin)}${place(destination)}!6i10!3m1!1sja!5m1!1sja`;
}

export function safeExternalUrl(value: string) {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.toString() : "";
  } catch {
    return "";
  }
}

export function useOnlineStatus() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}
