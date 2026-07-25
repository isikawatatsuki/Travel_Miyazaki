import { useEffect, useState } from "react";
import { AlertCircle, ArrowLeft, CalendarDays, CircleDollarSign, Cloud, HardDrive, Home, Luggage, RefreshCw, Settings, Share2, WifiOff, X } from "lucide-react";
import { TripProvider, useTrip } from "./TripContext";
import { useOnlineStatus } from "./lib";
import type { PageKey } from "./types";
import { HomePage } from "./pages/HomePage";
import { PlanPage } from "./pages/PlanPage";
import { MoneyPage } from "./pages/MoneyPage";
import { PackingPage } from "./pages/PackingPage";
import { SharePage } from "./pages/SharePage";
import { DetailsPage } from "./pages/DetailsPage";
import { TicketsPage } from "./pages/TicketsPage";
import { TravelMapPage } from "./pages/TravelMapPage";
import { SettingsDrawer } from "./components/SettingsDrawer";

const pages: Array<{ id: PageKey; label: string; icon: typeof Home }> = [
  { id: "home", label: "ホーム", icon: Home },
  { id: "plan", label: "予定", icon: CalendarDays },
  { id: "money", label: "お金", icon: CircleDollarSign },
  { id: "packing", label: "持ち物", icon: Luggage },
  { id: "share", label: "共有", icon: Share2 },
];
const validPages: PageKey[] = [...pages.map((page) => page.id), "details", "album", "tickets", "map"];
/** チケットを開いていない画面。ここでは下部ナビと旅の設定を隠す。 */
const shellFreePages: PageKey[] = ["tickets", "map"];

function pageFromHash(): PageKey {
  const value = window.location.hash.replace("#", "") as PageKey;
  return validPages.includes(value) ? value : "tickets";
}

function AppShell() {
  const [page, setPage] = useState<PageKey>(pageFromHash);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [storageOpen, setStorageOpen] = useState(false);
  const online = useOnlineStatus();
  const { activeGroup, activeTicket, syncStatus, savePhase, lastSavedAt, retrySave } = useTrip();

  const storageLabel = !online
    ? "オフライン"
    : savePhase === "error"
      ? activeGroup ? "同期エラー" : "保存エラー"
      : savePhase === "saving"
        ? "保存中…"
        : savePhase === "syncing"
          ? "同期中…"
          : activeGroup ? "共有済み" : "端末保存";
  const StorageIcon = !online ? WifiOff : savePhase === "error" ? AlertCircle : activeGroup ? Cloud : HardDrive;
  const savedTime = lastSavedAt ? new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(lastSavedAt)) : "まだ保存されていません";

  useEffect(() => {
    const onHashChange = () => {
      setPage(pageFromHash());
      window.scrollTo({ top: 0, behavior: "smooth" });
      window.requestAnimationFrame(() => document.getElementById("main-content")?.focus());
    };
    window.addEventListener("hashchange", onHashChange);
    if (!window.location.hash) window.history.replaceState(null, "", "#tickets");
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const goToTicket = (_id: string) => { window.location.hash = "#home"; };

  const pageContent = {
    tickets: <TicketsPage onOpenTicket={goToTicket} />,
    map: <TravelMapPage onOpenTicket={goToTicket} />,
    home: <HomePage />,
    plan: <PlanPage />,
    money: <MoneyPage />,
    packing: <PackingPage />,
    share: <SharePage />,
    details: <DetailsPage />,
    album: <DetailsPage initialView="album" />,
  }[page];

  const inTicket = !shellFreePages.includes(page);

  return (
    <div className={`app-shell ${inTicket ? "" : "is-tickets"}`}>
      <header className="app-header">
        {inTicket ? (
          <a className="brand brand-back" href="#tickets" aria-label="チケット一覧へ戻る">
            <ArrowLeft size={18} aria-hidden="true" />
            <span>
              <small>チケット一覧</small>
              <strong>{activeTicket?.name || "旅のしおり"}</strong>
            </span>
          </a>
        ) : (
          <a className="brand" href="#tickets" aria-label="旅のチケット">
            <img src="/icons/icon-192.png" alt="" width={30} height={30} />
            <span>
              <small>tabi log</small>
              <strong>旅のチケット</strong>
            </span>
          </a>
        )}
        <div className="header-actions">
          <div className="storage-status-wrap">
            <button className={`sync-pill ${!online ? "is-offline" : ""} ${savePhase === "error" ? "is-error" : ""}`} type="button" aria-expanded={storageOpen} onClick={() => setStorageOpen((current) => !current)} title={syncStatus}>
              <StorageIcon size={14} aria-hidden="true" />{storageLabel}
            </button>
            {storageOpen && <div className="storage-popover">
              <div><strong>{storageLabel}</strong><button className="popover-close" type="button" onClick={() => setStorageOpen(false)} aria-label="保存状態を閉じる"><X size={17} /></button></div>
              <p>{activeGroup ? syncStatus : "変更内容はこのブラウザに自動保存されます。"}</p>
              <small>最終保存：{savedTime}</small>
              {savePhase === "error" && <button className="button button-secondary small" type="button" onClick={retrySave}><RefreshCw size={16} />再試行</button>}
            </div>}
          </div>
          {inTicket && (
            <button className="icon-button" type="button" onClick={() => setSettingsOpen(true)} aria-label="旅の設定を開く">
              <Settings size={22} aria-hidden="true" />
            </button>
          )}
        </div>
      </header>

      <main id="main-content" className="main-content" tabIndex={-1}>
        {pageContent}
      </main>

      {inTicket && (
        <nav className="bottom-nav" aria-label="メインメニュー">
          {pages.map(({ id, label, icon: Icon }) => (
            <a key={id} href={`#${id}`} className={page === id ? "is-active" : ""} aria-current={page === id ? "page" : undefined}>
              <Icon size={22} aria-hidden="true" />
              <span>{label}</span>
            </a>
          ))}
        </nav>
      )}
      <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

export default function App() {
  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);
  return <TripProvider><AppShell /></TripProvider>;
}
