import { useEffect, useState } from "react";
import { CalendarDays, CircleDollarSign, Home, Luggage, Settings, Share2 } from "lucide-react";
import { TripProvider, useTrip } from "./TripContext";
import { useOnlineStatus } from "./lib";
import type { PageKey } from "./types";
import { HomePage } from "./pages/HomePage";
import { PlanPage } from "./pages/PlanPage";
import { MoneyPage } from "./pages/MoneyPage";
import { PackingPage } from "./pages/PackingPage";
import { SharePage } from "./pages/SharePage";
import { SettingsDrawer } from "./components/SettingsDrawer";

const pages: Array<{ id: PageKey; label: string; icon: typeof Home }> = [
  { id: "home", label: "ホーム", icon: Home },
  { id: "plan", label: "予定", icon: CalendarDays },
  { id: "money", label: "お金", icon: CircleDollarSign },
  { id: "packing", label: "持ち物", icon: Luggage },
  { id: "share", label: "共有", icon: Share2 },
];

function pageFromHash(): PageKey {
  const value = window.location.hash.replace("#", "") as PageKey;
  return pages.some((page) => page.id === value) ? value : "home";
}

function AppShell() {
  const [page, setPage] = useState<PageKey>(pageFromHash);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const online = useOnlineStatus();
  const { activeGroup, syncStatus } = useTrip();

  useEffect(() => {
    const onHashChange = () => {
      setPage(pageFromHash());
      window.scrollTo({ top: 0, behavior: "smooth" });
      window.requestAnimationFrame(() => document.getElementById("main-content")?.focus());
    };
    window.addEventListener("hashchange", onHashChange);
    if (!window.location.hash) window.history.replaceState(null, "", "#home");
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const pageContent = {
    home: <HomePage />,
    plan: <PlanPage />,
    money: <MoneyPage />,
    packing: <PackingPage />,
    share: <SharePage />,
  }[page];

  return (
    <div className="app-shell">
      <header className="app-header">
        <a className="brand" href="#home" aria-label="旅のしおり ホーム">
          <span>tabi log</span>
          <strong>旅のしおり</strong>
        </a>
        <div className="header-actions">
          <span className={`sync-pill ${online ? "" : "is-offline"}`} title={syncStatus}>
            <i aria-hidden="true" />{online ? (activeGroup ? "共有中" : "端末保存") : "オフライン"}
          </span>
          <button className="icon-button" type="button" onClick={() => setSettingsOpen(true)} aria-label="旅の設定を開く">
            <Settings size={22} aria-hidden="true" />
          </button>
        </div>
      </header>

      <main id="main-content" className="main-content" tabIndex={-1}>
        {pageContent}
      </main>

      <nav className="bottom-nav" aria-label="メインメニュー">
        {pages.map(({ id, label, icon: Icon }) => (
          <a key={id} href={`#${id}`} className={page === id ? "is-active" : ""} aria-current={page === id ? "page" : undefined}>
            <Icon size={22} aria-hidden="true" />
            <span>{label}</span>
          </a>
        ))}
      </nav>
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
