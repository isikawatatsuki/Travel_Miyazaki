import { useEffect, useState, type ChangeEvent } from "react";
import { Camera, CalendarClock, FileText, History, ImagePlus, MapPin, Paperclip, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useTrip } from "../TripContext";
import { makeId } from "../lib";
import type { Reservation, ReservationType } from "../types";
import { EmptyState, IconButton, Panel, SectionHeading } from "../components/ui";

type DetailView = "reservations" | "album" | "history";

function readFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function compressPhoto(file: File) {
  const source = await readFile(file);
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("写真を読み込めませんでした。"));
    image.src = source;
  });
  const max = 960;
  const scale = Math.min(1, max / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.6);
}

const typeLabels: Record<ReservationType, string> = { transport: "移動", stay: "宿泊", activity: "遊び・食事", other: "その他" };

export function DetailsPage({ initialView = "reservations" }: { initialView?: DetailView }) {
  const { tripSettings, reservations, setReservations, album, setAlbum, history, canUndo, undoLastChange } = useTrip();
  const [view, setView] = useState<DetailView>(initialView);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => { setView(initialView); }, [initialView]);

  const updateReservation = (id: string, patch: Partial<Reservation>) => setReservations((current) => ({
    items: current.items.map((item) => item.id === id ? { ...item, ...patch } : item),
  }));
  const addReservation = () => setReservations((current) => ({ items: [...current.items, {
    id: makeId("reservation"), type: "transport", title: "", reference: "", date: tripSettings.startDate,
    time: "", deadline: "", memo: "", attachmentName: "", attachmentData: "",
  }] }));
  const attachReservation = async (id: string, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 250_000) { setMessage("添付ファイルは250KB以下にしてください。"); event.target.value = ""; return; }
    updateReservation(id, { attachmentName: file.name, attachmentData: await readFile(file) });
    setMessage("予約資料を保存しました。");
  };
  const addPhotos = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = [...(event.target.files || [])].slice(0, Math.max(0, 12 - album.items.length));
    if (!files.length) return;
    setPhotoBusy(true); setMessage("");
    try {
      const created = [];
      let failed = 0;
      for (const file of files) {
        try {
          let dataUrl = "";
          try { dataUrl = await compressPhoto(file); }
          catch {
            if (file.size > 600_000) throw new Error("画像を圧縮できませんでした。");
            dataUrl = await readFile(file);
          }
          created.push({ id: makeId("photo"), dataUrl, caption: "", date: tripSettings.startDate, place: "", createdAt: new Date().toISOString() });
        } catch { failed += 1; }
      }
      if (!created.length) throw new Error("写真を読み込めませんでした。");
      setAlbum((current) => ({ items: [...created, ...current.items].slice(0, 12) }));
      setMessage(failed ? `${created.length}枚を追加しました。${failed}枚は読み込めませんでした。` : `${created.length}枚の写真を追加しました。`);
    } catch { setMessage("写真を追加できませんでした。"); }
    finally { setPhotoBusy(false); event.target.value = ""; }
  };

  return <div className="page details-page">
    <SectionHeading eyebrow="TRIP DETAILS" title="旅の詳細" description="予約、写真、変更履歴を旅行ごとにまとめます。" />
    <div className="detail-tabs" role="tablist" aria-label="詳細メニュー">
      <button className={view === "reservations" ? "is-active" : ""} role="tab" aria-selected={view === "reservations"} onClick={() => setView("reservations")}><CalendarClock size={18} />予約</button>
      <button className={view === "album" ? "is-active" : ""} role="tab" aria-selected={view === "album"} onClick={() => setView("album")}><Camera size={18} />アルバム</button>
      <button className={view === "history" ? "is-active" : ""} role="tab" aria-selected={view === "history"} onClick={() => setView("history")}><History size={18} />履歴</button>
    </div>
    {message && <p className="detail-message" aria-live="polite">{message}</p>}

    {view === "reservations" && <section>
      <SectionHeading eyebrow="BOOKINGS" title="予約情報" action={<button className="button button-primary small" type="button" onClick={addReservation}><Plus size={17} />追加</button>} />
      <div className="reservation-list">{reservations.items.length ? reservations.items.map((item) => <Panel className="reservation-card" key={item.id}>
        <div className="reservation-card-head"><select aria-label="予約の種類" value={item.type} onChange={(event) => updateReservation(item.id, { type: event.target.value as ReservationType })}>{Object.entries(typeLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select><IconButton label="予約を削除" className="danger" onClick={() => setReservations((current) => ({ items: current.items.filter((entry) => entry.id !== item.id) }))}><Trash2 size={18} /></IconButton></div>
        <label><span>予約名</span><input value={item.title} placeholder="例：Peach MM193" onChange={(event) => updateReservation(item.id, { title: event.target.value })} /></label>
        <div className="field-grid two"><label><span>日付</span><input type="date" value={item.date} onChange={(event) => updateReservation(item.id, { date: event.target.value })} /></label><label><span>時間</span><input type="time" value={item.time} onChange={(event) => updateReservation(item.id, { time: event.target.value })} /></label></div>
        <div className="field-grid two"><label><span>予約番号</span><input type="password" value={item.reference} placeholder="入力内容は伏せ字で表示" onChange={(event) => updateReservation(item.id, { reference: event.target.value })} /></label><label><span>キャンセル期限</span><input type="date" value={item.deadline} onChange={(event) => updateReservation(item.id, { deadline: event.target.value })} /></label></div>
        <label><span>メモ</span><textarea rows={2} value={item.memo} onChange={(event) => updateReservation(item.id, { memo: event.target.value })} /></label>
        <label className="file-button"><Paperclip size={17} /><span>{item.attachmentName || "予約画面・PDFを添付（250KBまで）"}</span><input type="file" accept="image/*,.pdf" onChange={(event) => attachReservation(item.id, event)} /></label>
        {item.attachmentData && <a className="inline-map-link" href={item.attachmentData} target="_blank" rel="noreferrer"><FileText size={17} />添付資料を開く</a>}
      </Panel>) : <EmptyState>予約情報はまだありません。</EmptyState>}</div>
    </section>}

    {view === "album" && <section>
      <SectionHeading eyebrow="MEMORIES" title="旅のアルバム" description="最大12枚。写真は軽くして、この旅行の共有データに保存します。" action={<div className="photo-actions">
        <label className={`button button-secondary small ${photoBusy || album.items.length >= 12 ? "is-disabled" : ""}`} htmlFor="album-camera"><Camera size={17} />カメラで撮る</label>
        <label className={`button button-primary small ${photoBusy || album.items.length >= 12 ? "is-disabled" : ""}`} htmlFor="album-files"><ImagePlus size={17} />{photoBusy ? "追加中…" : "写真を選ぶ"}</label>
      </div>} />
      <input className="visually-hidden" id="album-camera" type="file" accept="image/*" capture="environment" disabled={photoBusy || album.items.length >= 12} onChange={addPhotos} />
      <input className="visually-hidden" id="album-files" type="file" accept="image/*" multiple disabled={photoBusy || album.items.length >= 12} onChange={addPhotos} />
      {album.items.length ? <div className="album-grid">{album.items.map((photo) => <article className="photo-card" key={photo.id}>
        <img src={photo.dataUrl} alt={photo.caption || "旅行の写真"} />
        <div><label><span>ひとこと</span><input value={photo.caption} placeholder="この日の思い出" onChange={(event) => setAlbum((current) => ({ items: current.items.map((item) => item.id === photo.id ? { ...item, caption: event.target.value } : item) }))} /></label><div className="photo-meta"><label><span>日付</span><input type="date" value={photo.date} onChange={(event) => setAlbum((current) => ({ items: current.items.map((item) => item.id === photo.id ? { ...item, date: event.target.value } : item) }))} /></label><label><span>場所</span><input value={photo.place} placeholder="場所" onChange={(event) => setAlbum((current) => ({ items: current.items.map((item) => item.id === photo.id ? { ...item, place: event.target.value } : item) }))} /></label></div></div>
        <IconButton label="写真を削除" className="photo-delete danger" onClick={() => setAlbum((current) => ({ items: current.items.filter((item) => item.id !== photo.id) }))}><Trash2 size={18} /></IconButton>
      </article>)}</div> : <EmptyState>旅先で撮った写真をここに追加できます。</EmptyState>}
    </section>}

    {view === "history" && <section>
      <SectionHeading eyebrow="HISTORY" title="変更履歴" description="この旅行で変更した内容を新しい順に表示します。" action={<button className="button button-secondary small" type="button" disabled={!canUndo} onClick={undoLastChange}><RotateCcw size={17} />元に戻す</button>} />
      <Panel className="history-panel">{history.items.length ? history.items.map((item) => <div className="history-row" key={item.id}><History size={17} /><div><strong>{item.text}</strong><span>{item.source}・{new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(item.createdAt))}</span></div></div>) : <EmptyState>変更履歴はまだありません。</EmptyState>}</Panel>
    </section>}
  </div>;
}
