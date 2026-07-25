import { Check, MapPin, TriangleAlert } from "lucide-react";
import { parsePlaceName, resolvePlace } from "../tickets";

export type PlaceValue = { url: string; label: string };

/**
 * 場所の入力はGoogleマップのURL 1本に統一する。地名も座標も同じURLから
 * 取り出すので、「名前だけ新しくて座標が古い」という食い違いが起きない。
 * URLに地名が含まれない形式のときだけ、表示名を別に尋ねる。
 */
export function PlaceField({ title, value, onChange, hint }: {
  title: string;
  value: PlaceValue;
  onChange: (next: PlaceValue) => void;
  hint?: string;
}) {
  const place = resolvePlace(value.url, value.label);
  const needsLabel = Boolean(place) && !parsePlaceName(value.url);
  const isShortLink = /maps\.app\.goo\.gl|goo\.gl\/maps/.test(value.url);

  return (
    <div className="place-field">
      <label>
        <span>{title}</span>
        <input
          type="url"
          inputMode="url"
          value={value.url}
          placeholder="https://www.google.com/maps/place/..."
          onChange={(event) => onChange({ ...value, url: event.target.value.trim() })}
        />
      </label>

      {hint && !value.url && <p className="place-hint">{hint}</p>}

      {value.url && !place && (
        <p className="place-hint is-error">
          <TriangleAlert size={15} aria-hidden="true" />
          {isShortLink
            ? "短縮URLには場所の情報が入っていません。地図を開いて、アドレスバーの長いURLを貼ってください。"
            : "このURLからは場所を読み取れません。Googleマップで場所を開いたときのURLを貼ってください。"}
        </p>
      )}

      {place && (
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
