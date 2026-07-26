import { useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { mapsSearch } from "../lib";
import { isValidCoordinate, TICKET_COLORS } from "../tickets";
import type { PlaceValue } from "./PlaceField";
import { LocationPicker } from "./LocationPicker";
import { MapLocationField } from "./MapLocationField";

export type NewTicket = {
  name: string;
  themeColor: string;
  startDate: string;
  endDate: string;
  origin: PlaceValue;
  destination: PlaceValue;
};

const empty: PlaceValue = { url: "", label: "" };

function isoDate(offsetDays: number) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

/**
 * チケットを発行するときに、名前・色・出発地・目的地をまとめて尋ねる。
 * 出発地と目的地はホームの背景地図に要るので、あとから設定を探させずここで聞く。
 * 場所は任意。空でも作れて、あとから予定ページで足せる。
 */
export function NewTicketDialog({ open, onClose, onCreate, busy }: {
  open: boolean;
  onClose: () => void;
  onCreate: (ticket: NewTicket) => void;
  busy: boolean;
}) {
  const [name, setName] = useState("");
  const [themeColor, setThemeColor] = useState(TICKET_COLORS[0]);
  const [startDate, setStartDate] = useState(isoDate(0));
  const [endDate, setEndDate] = useState(isoDate(2));
  const [origin, setOrigin] = useState<PlaceValue>(empty);
  const [destination, setDestination] = useState<PlaceValue>(empty);
  const [locationTarget, setLocationTarget] = useState<"origin" | "destination" | null>(null);
  const locationTargetRef = useRef(locationTarget);
  locationTargetRef.current = locationTarget;
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setName(""); setThemeColor(TICKET_COLORS[0]); setOrigin(empty); setDestination(empty); setLocationTarget(null);
    setStartDate(isoDate(0)); setEndDate(isoDate(2));
    const focus = window.setTimeout(() => nameRef.current?.focus(), 60);
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape" && !busy && !locationTargetRef.current) onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => { window.clearTimeout(focus); window.removeEventListener("keydown", onKeyDown); };
  }, [busy, onClose, open]);

  if (!open) return null;

  return (
    <div className="dialog-layer">
      <button className="dialog-scrim" type="button" aria-label="閉じる" disabled={busy} onClick={onClose} />
      <section className="dialog" role="dialog" aria-modal="true" aria-labelledby="new-ticket-title">
        <header>
          <div>
            <p className="eyebrow">NEW TICKET</p>
            <h2 id="new-ticket-title">チケットを発行する</h2>
          </div>
          <button className="icon-button" type="button" aria-label="閉じる" disabled={busy} onClick={onClose}><X size={20} /></button>
        </header>

        <form onSubmit={(event) => { event.preventDefault(); onCreate({ name, themeColor, startDate, endDate, origin, destination }); }}>
          <label>
            <span>旅行名</span>
            <input ref={nameRef} value={name} maxLength={40} placeholder="例：宮崎旅行" onChange={(event) => setName(event.target.value)} />
          </label>

          <div className="field-grid two">
            <label><span>出発日</span><input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label>
            <label><span>帰宅日</span><input type="date" min={startDate} value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label>
          </div>

          <fieldset className="color-picker">
            <legend>テーマカラー</legend>
            {TICKET_COLORS.map((value) => (
              <label key={value} className="color-swatch" style={{ ["--swatch" as string]: value }}>
                <input type="radio" name="new-ticket-color" value={value} checked={themeColor === value} onChange={() => setThemeColor(value)} />
                <span aria-hidden="true" />
                <span className="visually-hidden">カラー {value}</span>
              </label>
            ))}
          </fieldset>

          <div className="dialog-places">
            <p className="dialog-places-lead">どこからどこへ行きますか</p>
            <p className="dialog-places-note">
              アプリ内の地図でピンを置き、場所の名前を付けてください。あとから予定ページで変更できます。
            </p>
            <MapLocationField title="出発地" name={origin.label} selected={isValidCoordinate(origin.lat, origin.lng)} mapUrl={origin.url} onOpen={() => setLocationTarget("origin")} />
            <MapLocationField title="目的地" name={destination.label} selected={isValidCoordinate(destination.lat, destination.lng)} mapUrl={destination.url} onOpen={() => setLocationTarget("destination")} />
          </div>

          <div className="dialog-actions">
            <button className="button button-quiet" type="button" disabled={busy} onClick={onClose}>やめる</button>
            <button className="button button-primary" type="submit" disabled={busy}><Plus size={18} />チケットを発行</button>
          </div>
        </form>
      </section>
      {locationTarget && (() => {
        const value = locationTarget === "origin" ? origin : destination;
        const initial = isValidCoordinate(value.lat, value.lng) ? { lat: value.lat as number, lng: value.lng as number } : undefined;
        return <LocationPicker initial={initial} initialName={value.label} onClose={() => setLocationTarget(null)} onConfirm={(location) => {
          const next = { url: mapsSearch(`${location.lat},${location.lng}`), label: location.name, lat: location.lat, lng: location.lng };
          if (locationTarget === "origin") setOrigin(next); else setDestination(next);
          setLocationTarget(null);
        }} />;
      })()}
    </div>
  );
}
