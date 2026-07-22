import { Download, RotateCcw, Save, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useTrip } from "../TripContext";
import { defaultTripSettings } from "../data";
import type { TripSettings } from "../types";
import { IconButton } from "./ui";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function SettingsDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { tripSettings, setTripSettings } = useTrip();
  const [draft, setDraft] = useState(tripSettings);
  const [status, setStatus] = useState("");
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);

  useEffect(() => { if (open) setDraft(tripSettings); }, [open, tripSettings]);
  useEffect(() => {
    const listener = (event: Event) => { event.preventDefault(); setInstallPrompt(event as InstallPromptEvent); };
    window.addEventListener("beforeinstallprompt", listener);
    return () => window.removeEventListener("beforeinstallprompt", listener);
  }, []);
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  const field = <K extends keyof TripSettings>(key: K, value: TripSettings[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const save = async () => {
    setStatus("反映中...");
    await new Promise((resolve) => window.setTimeout(resolve, 450));
    const formatter = (date: string) => date.replaceAll("-", ".");
    setTripSettings({ ...draft, dateLabel: `${formatter(draft.startDate)} - ${formatter(draft.endDate).slice(5)}` });
    setStatus("設定を反映しました");
    window.setTimeout(onClose, 350);
  };
  const install = async () => {
    if (installPrompt) {
      await installPrompt.prompt();
      await installPrompt.userChoice;
      setInstallPrompt(null);
      setStatus("ホーム画面への追加を確認しました");
      return;
    }
    setStatus(/iphone|ipad|ipod/i.test(navigator.userAgent) ? "Safariの共有ボタンから「ホーム画面に追加」を選んでください" : "ブラウザのメニューから「アプリをインストール」を選んでください");
  };

  return (
    <>
      <button className={`drawer-scrim ${open ? "is-open" : ""}`} type="button" aria-label="設定を閉じる" onClick={onClose} />
      <aside className={`settings-drawer ${open ? "is-open" : ""}`} aria-hidden={!open} aria-labelledby="settings-title">
        <div className="drawer-header"><div><p className="eyebrow">SETTINGS</p><h2 id="settings-title">旅の設定</h2></div><IconButton label="設定を閉じる" onClick={onClose}><X size={22} /></IconButton></div>
        <div className="drawer-body">
          <fieldset><legend>基本情報</legend>
            <label><span>しおりのタイトル</span><input value={draft.tripName} onChange={(event) => field("tripName", event.target.value)} /></label>
            <div className="field-grid two"><label><span>出発日</span><input type="date" value={draft.startDate} onChange={(event) => field("startDate", event.target.value)} /></label><label><span>帰宅日</span><input type="date" min={draft.startDate} value={draft.endDate} onChange={(event) => field("endDate", event.target.value)} /></label></div>
            <label><span>旅のルート</span><input value={draft.routeLabel} placeholder="例：大阪から札幌へ" onChange={(event) => field("routeLabel", event.target.value)} /></label>
          </fieldset>
          <fieldset><legend>移動</legend>
            <label><span>行きの便・交通</span><input value={draft.outboundLabel} onChange={(event) => field("outboundLabel", event.target.value)} /></label>
            <label><span>帰りの便・交通</span><input value={draft.returnLabel} onChange={(event) => field("returnLabel", event.target.value)} /></label>
            <div className="field-grid two"><label><span>家を出る時間</span><input type="time" value={draft.departureTime} onChange={(event) => field("departureTime", event.target.value)} /></label><label><span>到着目標</span><input type="time" value={draft.arrivalTargetTime} onChange={(event) => field("arrivalTargetTime", event.target.value)} /></label></div>
            <div className="field-grid two"><label><span>地図の出発地</span><input value={draft.mapOrigin} onChange={(event) => field("mapOrigin", event.target.value)} /></label><label><span>地図の目的地</span><input value={draft.mapDestination} onChange={(event) => field("mapDestination", event.target.value)} /></label></div>
            <details className="coordinate-settings">
              <summary>背景ルートの位置を調整</summary>
              <p>地図の位置がずれるときだけ、緯度・経度を調整します。</p>
              <div className="field-grid two"><label><span>出発地の緯度</span><input type="number" step="0.000001" value={draft.mapOriginLat} onChange={(event) => field("mapOriginLat", Number(event.target.value))} /></label><label><span>出発地の経度</span><input type="number" step="0.000001" value={draft.mapOriginLng} onChange={(event) => field("mapOriginLng", Number(event.target.value))} /></label></div>
              <div className="field-grid two"><label><span>目的地の緯度</span><input type="number" step="0.000001" value={draft.mapDestinationLat} onChange={(event) => field("mapDestinationLat", Number(event.target.value))} /></label><label><span>目的地の経度</span><input type="number" step="0.000001" value={draft.mapDestinationLng} onChange={(event) => field("mapDestinationLng", Number(event.target.value))} /></label></div>
            </details>
            <label><span>移動メモ</span><textarea rows={2} value={draft.mapNote} onChange={(event) => field("mapNote", event.target.value)} /></label>
          </fieldset>
          <fieldset><legend>泊まるところ</legend>
            <label><span>ホテル名</span><input value={draft.hotelName} onChange={(event) => field("hotelName", event.target.value)} /></label>
            <label><span>住所</span><input value={draft.hotelAddress} onChange={(event) => field("hotelAddress", event.target.value)} /></label>
          </fieldset>
          <div className="app-actions">
            <button className="button button-secondary" type="button" onClick={install}><Download size={18} />ホーム画面に追加</button>
            <button className="button button-secondary" type="button" onClick={() => window.print()}>印刷する</button>
          </div>
          <p className="drawer-status" aria-live="polite">{status}</p>
        </div>
        <div className="drawer-footer">
          <button className="button button-quiet" type="button" onClick={() => { setDraft(defaultTripSettings); setStatus("初期値を読み込みました。反映すると保存されます"); }}><RotateCcw size={18} />初期値</button>
          <button className="button button-primary" type="button" onClick={save}><Save size={18} />反映する</button>
        </div>
      </aside>
    </>
  );
}
