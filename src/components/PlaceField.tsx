import { useEffect, useRef, useState } from "react";
import { Check, LoaderCircle, MapPin, TriangleAlert } from "lucide-react";
import { parseLatLng, parsePlaceName, placeQueryCandidates, resolvePlace } from "../tickets";

export type PlaceValue = { url: string; label: string; lat?: number; lng?: number };

const SHORT_LINK = /^https:\/\/(maps\.app\.goo\.gl|goo\.gl)\//;

/**
 * 場所の入力はGoogleマップのURL 1本に統一する。地名も座標も同じURLから
 * 取り出すので、「名前だけ新しくて座標が古い」という食い違いが起きない。
 *
 * スマホから共有すると短縮URLになり座標を持たないので、貼られた時点で
 * サーバーへ展開を頼み、返ってきた長いURLへ差し替える。
 */
export function PlaceField({ title, value, onChange, hint, showLabelField = true }: {
  title: string;
  value: PlaceValue;
  onChange: (next: PlaceValue) => void;
  hint?: string;
  /** 予定のように呼び名を別に持っている場合は false。二重に名前を聞かない。 */
  showLabelField?: boolean;
}) {
  const [busy, setBusy] = useState<"" | "expanding" | "geocoding">("");
  const [failure, setFailure] = useState("");
  const tried = useRef(new Set<string>());
  // 呼び出し側は毎レンダーで新しい value / onChange を渡してくる。これらを依存に
  // 入れると再レンダーのたびに後片付けが走り、通信中の展開を自分で打ち切ってしまう。
  // 依存はURL文字列だけにし、最新の関数と値は ref 越しに読む。
  const latest = useRef({ value, onChange });
  latest.current = { value, onChange };
  // 展開すると自分でURLを書き換えるため、この effect は自分の変更で再実行される。
  // 各実行ごとに中断していると、書き換えた直後に住所検索の続きが捨てられて
  // 「調べています…」のまま止まる。中断はアンマウント時だけにする。
  // 同じURLの二重処理は tried が防ぐ。
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  useEffect(() => {
    const url = latest.current.value.url;
    if (!url || tried.current.has(url)) return;
    const isShort = SHORT_LINK.test(url);
    const needsLookup = !isShort && !parseLatLng(url) && placeQueryCandidates(url).length > 0;
    if (!isShort && !needsLookup) return;
    tried.current.add(url);
    setBusy(isShort ? "expanding" : "geocoding"); setFailure("");

    void (async () => {
      try {
        let current = url;

        // 1) 短縮リンクなら展開する。
        if (SHORT_LINK.test(current)) {
          const response = await fetch("/api/resolve", {
            method: "POST", headers: { "content-type": "application/json" },
            body: JSON.stringify({ url: current }), credentials: "same-origin",
          });
          const payload = await response.json() as { url?: string; error?: string };
          if (!mounted.current) return;
          if (!response.ok || !payload.url) throw new Error(payload.error || "展開できませんでした。");
          current = payload.url;
          tried.current.add(current);
          latest.current.onChange({ ...latest.current.value, url: current });
        }

        // 2) 展開しても座標が無い形式がある。その場合は施設名で住所検索する。
        if (!parseLatLng(current)) {
          const candidates = placeQueryCandidates(current);
          if (!candidates.length) throw new Error("このリンクからは場所を読み取れませんでした。");
          if (mounted.current) setBusy("geocoding");
          for (const query of candidates) {
            const response = await fetch("/api/geocode", {
              method: "POST", headers: { "content-type": "application/json" },
              body: JSON.stringify({ query }), credentials: "same-origin",
            });
            const payload = await response.json() as { lat?: number; lng?: number; error?: string };
            if (!mounted.current) return;
            if (response.ok && typeof payload.lat === "number" && typeof payload.lng === "number") {
              latest.current.onChange({ ...latest.current.value, url: current, label: latest.current.value.label || query, lat: payload.lat, lng: payload.lng });
              return;
            }
            if (response.status === 429 || response.status === 503) throw new Error(payload.error || "混み合っています。");
          }
          throw new Error("この場所の位置が分かりませんでした。");
        }
      } catch (error) {
        if (mounted.current) setFailure(error instanceof Error ? error.message : "場所を調べられませんでした。");
      } finally {
        if (mounted.current) setBusy("");
      }
    })();
  }, [value.url]);

  const resolved = resolvePlace(value.url, value.label);
  const place = resolved
    || (typeof value.lat === "number" && typeof value.lng === "number"
      ? { url: value.url, name: parsePlaceName(value.url) || value.label || placeQueryCandidates(value.url)[0] || "指定した場所", lat: value.lat, lng: value.lng }
      : null);
  const needsLabel = showLabelField && Boolean(place) && !parsePlaceName(value.url);

  return (
    <div className="place-field">
      <label>
        <span>{title}</span>
        <input
          type="url"
          inputMode="url"
          value={value.url}
          placeholder="Googleマップのリンクを貼る"
          onChange={(event) => onChange({ ...value, url: event.target.value.trim() })}
        />
      </label>

      {hint && !value.url && <p className="place-hint">{hint}</p>}

      {busy && (
        <p className="place-hint">
          <LoaderCircle size={15} className="spin" aria-hidden="true" />
          {busy === "expanding" ? "リンクを開いています…" : "地図から位置を調べています…"}
        </p>
      )}

      {!busy && value.url && !place && (
        <p className="place-hint is-error">
          <TriangleAlert size={15} aria-hidden="true" />
          {failure || "このURLからは場所を読み取れません。Googleマップで場所を開いたときのリンクを貼ってください。"}
        </p>
      )}

      {!busy && place && (
        <p className="place-hint is-ok">
          <Check size={15} aria-hidden="true" />
          <MapPin size={15} aria-hidden="true" />
          {place.name}
        </p>
      )}

      {needsLabel && (
        <label className="place-label-field">
          <span>この場所の呼び名</span>
          <input
            value={value.label}
            maxLength={30}
            placeholder="例：弁天町駅"
            onChange={(event) => onChange({ ...value, label: event.target.value })}
          />
        </label>
      )}
    </div>
  );
}
