import { AlertCircle, Archive, CheckCircle2, Download, HardDrive, LoaderCircle, Luggage, MapPinned, Plus, RotateCcw, Save, Share2, Smartphone, Undo2, WifiOff, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useTrip } from "../TripContext";
import { defaultTripSettings } from "../data";
import type { TripSettings } from "../types";
import { IconButton } from "./ui";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface SaveProgress {
  percent: number;
  title: string;
  detail: string;
  state: "saving" | "complete" | "error";
}

function waitForSettingsSave() {
  return new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      window.removeEventListener("trip-storage", listener);
      reject(new Error("保存の確認に時間がかかっています。もう一度お試しください。"));
    }, 5000);
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<{ key?: string; phase?: string; message?: string }>).detail;
      if (detail?.key !== "tripShioriSettings" || !["saved", "error"].includes(detail.phase || "")) return;
      window.clearTimeout(timeout);
      window.removeEventListener("trip-storage", listener);
      if (detail.phase === "saved") resolve();
      else reject(new Error(detail.message || "設定を保存できませんでした。"));
    };
    window.addEventListener("trip-storage", listener);
  });
}

export function SettingsDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { tripSettings, setTripSettings, trips, activeTripId, createTrip, switchTrip, archiveTrip, restoreTrip } = useTrip();
  const [draft, setDraft] = useState(tripSettings);
  const [status, setStatus] = useState("");
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [settingsTab, setSettingsTab] = useState<"trip" | "move" | "app">("trip");
  const [newTripName, setNewTripName] = useState("");
  const [saveProgress, setSaveProgress] = useState<SaveProgress | null>(null);

  useEffect(() => { if (open) setDraft(tripSettings); }, [open, tripSettings]);
  useEffect(() => {
    const listener = (event: Event) => { event.preventDefault(); setInstallPrompt(event as InstallPromptEvent); };
    window.addEventListener("beforeinstallprompt", listener);
    return () => window.removeEventListener("beforeinstallprompt", listener);
  }, []);
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape" && !saveProgress) onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open, saveProgress]);

  const field = <K extends keyof TripSettings>(key: K, value: TripSettings[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const save = async () => {
    if (saveProgress && saveProgress.state !== "error") return;
    const wait = (duration: number) => new Promise((resolve) => window.setTimeout(resolve, duration));
    setStatus("");
    try {
      setSaveProgress({ percent: 15, title: "設定を確認中", detail: "入力した内容を確認しています", state: "saving" });
      await wait(220);
      const startDate = typeof draft.startDate === "string" && draft.startDate ? draft.startDate : defaultTripSettings.startDate;
      const endDate = typeof draft.endDate === "string" && draft.endDate ? draft.endDate : defaultTripSettings.endDate;
      const formatter = (date: string) => date.replaceAll("-", ".");
      const nextSettings = { ...defaultTripSettings, ...draft, startDate, endDate, dateLabel: `${formatter(startDate)} - ${formatter(endDate).slice(5)}` };
      const persisted = waitForSettingsSave();
      setSaveProgress({ percent: 45, title: "端末へ保存中", detail: "保存完了を確認しています", state: "saving" });
      setTripSettings(nextSettings);
      await persisted;
      setSaveProgress({ percent: 80, title: "画面へ反映中", detail: "しおりの表示を更新しています", state: "saving" });
      await wait(320);
      setSaveProgress({ percent: 100, title: "更新完了", detail: "設定を保存しました", state: "complete" });
      setStatus("設定を保存しました");
      await wait(760);
      setSaveProgress(null);
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : "設定を保存できませんでした。";
      setSaveProgress({ percent: 45, title: "保存できませんでした", detail: message, state: "error" });
      setStatus(message);
    }
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
      <button className={`drawer-scrim ${open ? "is-open" : ""}`} type="button" aria-label="設定を閉じる" onClick={saveProgress ? undefined : onClose} disabled={Boolean(saveProgress)} />
      <aside className={`settings-drawer ${open ? "is-open" : ""}`} aria-hidden={!open} aria-labelledby="settings-title">
        <div className="drawer-header"><div><p className="eyebrow">SETTINGS</p><h2 id="settings-title">旅の設定</h2></div><IconButton label="設定を閉じる" onClick={onClose} disabled={Boolean(saveProgress)}><X size={22} /></IconButton></div>
        <div className="drawer-body">
          <div className="settings-tabs" role="tablist" aria-label="設定カテゴリ">
            <button type="button" role="tab" aria-selected={settingsTab === "trip"} className={settingsTab === "trip" ? "is-active" : ""} onClick={() => setSettingsTab("trip")}><Luggage size={17} />旅行</button>
            <button type="button" role="tab" aria-selected={settingsTab === "move"} className={settingsTab === "move" ? "is-active" : ""} onClick={() => setSettingsTab("move")}><MapPinned size={17} />移動・宿</button>
            <button type="button" role="tab" aria-selected={settingsTab === "app"} className={settingsTab === "app" ? "is-active" : ""} onClick={() => setSettingsTab("app")}><Smartphone size={17} />アプリ</button>
          </div>
          {settingsTab === "trip" && <>
          <section className="trip-manager" aria-labelledby="trip-manager-title">
            <div className="storage-guide-heading"><Luggage size={19} /><h3 id="trip-manager-title">旅行を切り替える</h3></div>
            <div className="trip-list">{trips.filter((trip) => !trip.archived).map((trip) => <div className={trip.id === activeTripId ? "is-active" : ""} key={trip.id}>
              <button type="button" onClick={() => switchTrip(trip.id)}><strong>{trip.name}</strong><small>{new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric" }).format(new Date(trip.updatedAt))} 更新</small></button>
              <IconButton label={`${trip.name}をアーカイブ`} disabled={trips.filter((item) => !item.archived).length <= 1} onClick={() => archiveTrip(trip.id)}><Archive size={17} /></IconButton>
            </div>)}</div>
            <form className="new-trip-form" onSubmit={(event) => { event.preventDefault(); if (!newTripName.trim()) return; createTrip(newTripName); setNewTripName(""); }}><label><span>新しい旅行名</span><input value={newTripName} placeholder="例：北海道旅行" onChange={(event) => setNewTripName(event.target.value)} /></label><button className="button button-secondary" type="submit"><Plus size={17} />作成</button></form>
            {trips.some((trip) => trip.archived) && <details className="archived-trips"><summary>アーカイブした旅行</summary>{trips.filter((trip) => trip.archived).map((trip) => <div key={trip.id}><span>{trip.name}</span><button className="button button-quiet small" type="button" onClick={() => restoreTrip(trip.id)}><Undo2 size={16} />戻す</button></div>)}</details>}
          </section>
          <fieldset><legend>基本情報</legend>
            <label><span>しおりのタイトル</span><input value={draft.tripName} onChange={(event) => field("tripName", event.target.value)} /></label>
            <div className="field-grid two"><label><span>出発日</span><input type="date" value={draft.startDate} onChange={(event) => field("startDate", event.target.value)} /></label><label><span>帰宅日</span><input type="date" min={draft.startDate} value={draft.endDate} onChange={(event) => field("endDate", event.target.value)} /></label></div>
            <label><span>旅のルート</span><input value={draft.routeLabel} placeholder="例：大阪から札幌へ" onChange={(event) => field("routeLabel", event.target.value)} /></label>
          </fieldset>
          </>}
          {settingsTab === "move" && <>
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
          </>}
          {settingsTab === "app" && <>
          <div className="app-actions">
            <button className="button button-secondary" type="button" onClick={install}><Download size={18} />ホーム画面に追加</button>
            <button className="button button-secondary" type="button" onClick={() => window.print()}>印刷する</button>
          </div>
          <section className="storage-guide" aria-labelledby="storage-guide-title">
            <div className="storage-guide-heading">
              <HardDrive size={19} aria-hidden="true" />
              <h3 id="storage-guide-title">保存について</h3>
            </div>
            <div className="storage-guide-list">
              <div><HardDrive size={17} aria-hidden="true" /><p><strong>端末保存</strong><span>オンラインで共有グループに参加していない状態。変更内容は、このブラウザに自動保存されます。</span></p></div>
              <div><Share2 size={17} aria-hidden="true" /><p><strong>共有中</strong><span>オンラインでグループに参加している状態。変更内容はグループへ共有されます。</span></p></div>
              <div><WifiOff size={17} aria-hidden="true" /><p><strong>オフライン</strong><span>インターネットに接続していない状態。端末に保存済みの内容は引き続き確認できます。</span></p></div>
            </div>
            <p className="storage-guide-note">ヘッダーの表示は現在の保存方法を示すもので、保存完了を毎回確認する表示ではありません。ブラウザのサイトデータを削除すると、端末保存の内容も消去されます。</p>
          </section>
          </>}
          <p className="drawer-status" aria-live="polite">{status}</p>
        </div>
        <div className="drawer-footer">
          <button className="button button-quiet" type="button" disabled={Boolean(saveProgress)} onClick={() => { setDraft(defaultTripSettings); setStatus("初期値を読み込みました。反映すると保存されます"); }}><RotateCcw size={18} />初期値</button>
          <button className="button button-primary" type="button" disabled={Boolean(saveProgress)} onClick={save}>{saveProgress ? <LoaderCircle className="spin" size={18} /> : <Save size={18} />}{saveProgress ? "更新中" : "反映する"}</button>
        </div>
      </aside>
      {saveProgress && <div className="save-progress-layer">
        <section className={`save-progress-dialog is-${saveProgress.state}`} role="dialog" aria-modal="true" aria-labelledby="save-progress-title" aria-describedby="save-progress-detail">
          <div className="save-progress-icon" aria-hidden="true">
            {saveProgress.state === "complete" ? <CheckCircle2 size={34} /> : saveProgress.state === "error" ? <AlertCircle size={34} /> : <LoaderCircle className="spin" size={34} />}
          </div>
          <p className="eyebrow">UPDATING</p>
          <h2 id="save-progress-title">{saveProgress.title}</h2>
          <p id="save-progress-detail">{saveProgress.detail}</p>
          <div className="save-progress-track" role="progressbar" aria-label="設定の更新進捗" aria-valuemin={0} aria-valuemax={100} aria-valuenow={saveProgress.percent}>
            <i style={{ transform: `scaleX(${saveProgress.percent / 100})` }} />
          </div>
          <strong>{saveProgress.percent}%</strong>
          {saveProgress.state === "error" && <div className="save-progress-actions">
            <button className="button button-quiet" type="button" onClick={() => setSaveProgress(null)}>閉じる</button>
            <button className="button button-primary" type="button" onClick={save}>もう一度</button>
          </div>}
        </section>
      </div>}
    </>
  );
}
