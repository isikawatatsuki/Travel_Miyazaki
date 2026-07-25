import { useEffect, useRef, useState } from "react";
import { Check, LoaderCircle, MapPin, TriangleAlert } from "lucide-react";
import { parsePlaceName, resolvePlace } from "../tickets";

export type PlaceValue = { url: string; label: string };

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
  const [expanding, setExpanding] = useState(false);
  const [expandError, setExpandError] = useState("");
  const tried = useRef(new Set<string>());
  // 呼び出し側は毎レンダーで新しい value / onChange を渡してくる。これらを依存に
  // 入れると再レンダーのたびに後片付けが走り、通信中の展開を自分で打ち切ってしまう。
  // 依存はURL文字列だけにし、最新の関数と値は ref 越しに読む。
  const latest = useRef({ value, onChange });
  latest.current = { value, onChange };

  useEffect(() => {
    const url = latest.current.value.url;
    if (!SHORT_LINK.test(url) || tried.current.has(url)) return;
    tried.current.add(url);
    let cancelled = false;
    setExpanding(true); setExpandError("");
    void (async () => {
      try {
        const response = await fetch("/api/resolve", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ url }),
          credentials: "same-origin",
        });
        const payload = await response.json() as { url?: string; error?: string };
        if (cancelled) return;
        if (!response.ok || !payload.url) throw new Error(payload.error || "展開できませんでした。");
        latest.current.onChange({ ...latest.current.value, url: payload.url });
      } catch (error) {
        if (!cancelled) setExpandError(error instanceof Error ? error.message : "展開できませんでした。");
      } finally {
        if (!cancelled) setExpanding(false);
      }
    })();
    return () => { cancelled = true; };
  }, [value.url]);

  const place = resolvePlace(value.url, value.label);
  const needsLabel = showLabelField && Boolean(place) && !parsePlaceName(value.url);
  const isShortLink = SHORT_LINK.test(value.url);

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

      {expanding && (
        <p className="place-hint">
          <LoaderCircle size={15} className="spin" aria-hidden="true" />
          短縮リンクから場所を調べています…
        </p>
      )}

      {!expanding && value.url && !place && (
        <p className="place-hint is-error">
          <TriangleAlert size={15} aria-hidden="true" />
          {expandError
            || (isShortLink
              ? "この短縮リンクからは場所を読み取れませんでした。Googleマップで開き直してURLを貼ってください。"
              : "このURLからは場所を読み取れません。Googleマップで場所を開いたときのURLを貼ってください。")}
        </p>
      )}

      {!expanding && place && (
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
