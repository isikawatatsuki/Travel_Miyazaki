import { Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { TICKET_COLORS } from "../tickets";

export type NewTicketInput = {
  name: string;
  themeColor: string;
  startDate: string;
  endDate: string;
  origin: string;
  destination: string;
};

function isoDate(offsetDays: number) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

export function NewTicketDialog({ open, busy, onClose, onCreate }: {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onCreate: (ticket: NewTicketInput) => void;
}) {
  const [name, setName] = useState("");
  const [themeColor, setThemeColor] = useState(TICKET_COLORS[0]);
  const [startDate, setStartDate] = useState(isoDate(0));
  const [endDate, setEndDate] = useState(isoDate(2));
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);
  const busyRef = useRef(busy);
  busyRef.current = busy;

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    setName(""); setThemeColor(TICKET_COLORS[0]); setStartDate(isoDate(0)); setEndDate(isoDate(2)); setOrigin(""); setDestination("");
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => nameRef.current?.focus(), 40);
    const keydown = (event: KeyboardEvent) => { if (event.key === "Escape" && !busyRef.current) onClose(); };
    window.addEventListener("keydown", keydown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", keydown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className="ticket-dialog-layer">
      <button className="ticket-dialog-scrim" type="button" aria-label="チケット作成を閉じる" disabled={busy} onClick={onClose} />
      <section className="ticket-dialog" role="dialog" aria-modal="true" aria-labelledby="new-ticket-title">
        <header><div><p className="eyebrow">NEW TICKET</p><h2 id="new-ticket-title">チケットを発行する</h2></div><button className="icon-button" type="button" aria-label="閉じる" disabled={busy} onClick={onClose}><X size={20} /></button></header>
        <form onSubmit={(event) => { event.preventDefault(); onCreate({ name, themeColor, startDate, endDate, origin, destination }); }}>
          <label><span>旅行名</span><input ref={nameRef} required value={name} maxLength={40} placeholder="例：宮崎旅行" onChange={(event) => setName(event.target.value)} /></label>
          <div className="field-grid two"><label><span>出発日</span><input required type="date" value={startDate} onChange={(event) => { setStartDate(event.target.value); if (endDate < event.target.value) setEndDate(event.target.value); }} /></label><label><span>帰宅日</span><input required type="date" min={startDate} value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label></div>
          <fieldset className="ticket-color-picker"><legend>テーマカラー</legend><div>{TICKET_COLORS.map((color) => <label key={color} style={{ ["--swatch" as string]: color }}><input type="radio" name="ticket-color" value={color} checked={themeColor === color} onChange={() => setThemeColor(color)} /><span aria-hidden="true" /><em>カラー {color}</em></label>)}</div></fieldset>
          <div className="field-grid two"><label><span>出発地</span><input value={origin} maxLength={50} placeholder="例：大阪" onChange={(event) => setOrigin(event.target.value)} /></label><label><span>目的地</span><input value={destination} maxLength={50} placeholder="例：宮崎" onChange={(event) => setDestination(event.target.value)} /></label></div>
          <p className="ticket-dialog-note">詳しい場所と座標は、チケットを開いた後に「旅の設定」から編集できます。</p>
          <div className="ticket-dialog-actions"><button className="button button-quiet" type="button" disabled={busy} onClick={onClose}>やめる</button><button className="button button-primary" type="submit" disabled={busy || !name.trim()}><Plus size={18} />{busy ? "発行中..." : "チケットを発行"}</button></div>
        </form>
      </section>
    </div>
  );
}
