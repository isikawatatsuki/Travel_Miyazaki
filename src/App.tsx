import { lazy, Suspense, useEffect, useState } from "react";
import { ArrowLeft, CalendarDays, CircleDollarSign, Home, Luggage, Settings, Share2, Ticket } from "lucide-react";
import { TripProvider, useTrip } from "./TripContext";
import { useOnlineStatus } from "./lib";
import type { PageKey } from "./types";
import { HomePage } from "./pages/HomePage";
import { MoneyPage } from "./pages/MoneyPage";
import { PackingPage } from "./pages/PackingPage";
import { SharePage } from "./pages/SharePage";
import { SettingsDrawer } from "./components/SettingsDrawer";
import { TicketsPage } from "./pages/TicketsPage";

const PlanPage = lazy(() => import("./pages/PlanPage").then((module) => ({ default: module.PlanPage })));

type TicketPageKey = Exclude<PageKey, "tickets">;

const pages: Array<{ id: TicketPageKey; label: string; icon: typeof Home }> = [
  { id: "home", label: "ホーム", icon: Home },
  { id: "plan", label: "予定", icon: CalendarDays },
  { id: "money", label: "お金", icon: CircleDollarSign },
  { id: "packing", label: "持ち物", icon: Luggage },
  { id: "share", label: "共有", icon: Share2 },
];

function pageFromHash(): PageKey {
  const value = window.location.hash.replace("#", "") as PageKey;
  return value === "tickets" || pages.some((page) => page.id === value) ? value : "tickets";
}

function AppShell() {
  const [page, setPage] = useState<PageKey>(pageFromHash);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const online = useOnlineStatus();
  const { activeGroup, activeTicket, syncStatus } = useTrip();
  const inTicket = page !== "tickets";

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

  useEffect(() => {
    if (inTicket && !activeTicket) window.location.hash = "#tickets";
  }, [activeTicket, inTicket]);

  const pageContent = {
    tickets: <TicketsPage onOpenTicket={() => { window.location.hash = "#home"; }} />,
    home: <HomePage />,
    plan: <Suspense fallback={<p className="empty-state page-loading" role="status">地図と予定を読み込み中...</p>}><PlanPage /></Suspense>,
    money: <MoneyPage />,
    packing: <PackingPage />,
    share: <SharePage />,
  }[page];

  return (
    <div className={`app-shell ${inTicket ? "is-ticket-open" : "is-ticket-list"}`} style={inTicket ? { ["--ticket-color" as string]: activeTicket?.themeColor || "#23745b" } : undefined}>
      <header className="app-header">
        <a className={`brand ${inTicket ? "brand-back" : ""}`} href="#tickets" aria-label={inTicket ? "チケット一覧へ戻る" : "旅のチケット ホーム"}>
          {inTicket ? <ArrowLeft size={21} aria-hidden="true" /> : <Ticket size={22} aria-hidden="true" />}
          <span>{inTicket ? "チケット一覧" : "Travel Tickets"}</span>
          <strong>{inTicket ? activeTicket?.name || "旅のしおり" : "旅のチケット"}</strong>
        </a>
        <div className="header-actions">
          <span className={`sync-pill ${online ? "" : "is-offline"}`} title={syncStatus}>
            <i aria-hidden="true" />{online ? (activeGroup ? "共有中" : "端末保存") : "オフライン"}
          </span>
          {inTicket && <button className="icon-button" type="button" onClick={() => setSettingsOpen(true)} aria-label="旅の設定を開く">
            <Settings size={22} aria-hidden="true" />
          </button>}
        </div>
      </header>

      <main id="main-content" className="main-content" tabIndex={-1}>
        {pageContent}
      </main>

      {inTicket && <nav className="bottom-nav" aria-label="メインメニュー">
        {pages.map(({ id, label, icon: Icon }) => (
          <a key={id} href={`#${id}`} className={page === id ? "is-active" : ""} aria-current={page === id ? "page" : undefined}>
            <Icon size={22} aria-hidden="true" />
            <span>{label}</span>
          </a>
        ))}
      </nav>}
      {inTicket && <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}

export default function App() {
  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);
  return <TripProvider><AppShell /></TripProvider>;
}
