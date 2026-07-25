import { useState } from "react";
import { LogIn, LogOut, Map, Plus, TicketCheck, Ticket as TicketIcon } from "lucide-react";
import { useTrip } from "../TripContext";
import { TICKET_COLORS, sortTickets, ticketStatus } from "../tickets";
import { TicketCard } from "../components/TicketCard";
import { EmptyState, Panel } from "../components/ui";

export function TicketsPage({ onOpenTicket }: { onOpenTicket: (id: string) => void }) {
  const { trips, activeTripId, createTrip, switchTrip, joinGroup, accountUser, loginWithGoogle, logout } = useTrip();
  const [name, setName] = useState("");
  const [color, setColor] = useState(TICKET_COLORS[0]);
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  const sorted = sortTickets(trips);
  const visible = sorted.filter((ticket) => showArchived || ticketStatus(ticket) !== "archived");
  const archivedCount = sorted.length - sorted.filter((ticket) => ticketStatus(ticket) !== "archived").length;

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true); setMessage("");
    try { await action(); } catch (error) { setMessage(error instanceof Error ? error.message : "操作できませんでした。"); } finally { setBusy(false); }
  };

  const open = async (id: string) => {
    if (id !== activeTripId) await switchTrip(id);
    onOpenTicket(id);
  };

  return (
    <div className="page tickets-page">
      <header className="tickets-hero">
        <img src="/icons/icon-192.png" alt="" width={56} height={56} className="tickets-logo" />
        <div>
          <p className="eyebrow">TRAVEL TICKETS</p>
          <h1>旅のチケット</h1>
          <p className="tickets-lead">作った旅・参加した旅がチケットになります。選ぶと、その旅の予定・お金・持ち物を開けます。</p>
        </div>
        <div className="tickets-account">
          {accountUser
            ? <button className="button button-quiet small" type="button" onClick={() => run(logout)} disabled={busy}><LogOut size={16} />{accountUser.displayName || "ログアウト"}</button>
            : <button className="button button-quiet small" type="button" onClick={loginWithGoogle}><LogIn size={16} />ログイン</button>}
        </div>
      </header>

      <nav className="tickets-actions" aria-label="チケットの操作">
        <a className="button button-secondary" href="#map"><Map size={18} aria-hidden="true" />旅の地図を見る</a>
      </nav>

      <section className="section-block" aria-labelledby="ticket-list-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">MY TICKETS</p>
            <h2 id="ticket-list-title">チケット一覧</h2>
          </div>
          {archivedCount > 0 && (
            <button className="button button-quiet small" type="button" aria-pressed={showArchived} onClick={() => setShowArchived((current) => !current)}>
              アーカイブ{showArchived ? "を隠す" : `を表示（${archivedCount}）`}
            </button>
          )}
        </div>

        {message && <p className="tickets-error" role="alert">{message}</p>}

        {visible.length ? (
          <ul className="ticket-list">
            {visible.map((ticket) => (
              <li key={ticket.id}>
                <TicketCard ticket={ticket} active={ticket.id === activeTripId} onOpen={() => void open(ticket.id)} />
              </li>
            ))}
          </ul>
        ) : (
          <Panel className="tickets-empty">
            <TicketCheck size={36} aria-hidden="true" />
            <strong>チケットはまだありません</strong>
            <EmptyState>下の「新しいチケットを作る」から旅を始めるか、友だちからもらった6桁の参加コードで参加できます。</EmptyState>
          </Panel>
        )}
      </section>

      <section className="section-block">
        <div className="section-heading"><div><p className="eyebrow">NEW</p><h2>新しいチケットを作る</h2></div></div>
        <Panel className="ticket-form">
          <form onSubmit={(event) => { event.preventDefault(); void run(async () => { const id = await createTrip(name, color); setName(""); if (id) onOpenTicket(id); }); }}>
            <label><span>旅行名</span><input value={name} maxLength={40} placeholder="例：宮崎旅行" onChange={(event) => setName(event.target.value)} /></label>
            <fieldset className="color-picker">
              <legend>テーマカラー</legend>
              {TICKET_COLORS.map((value) => (
                <label key={value} className="color-swatch" style={{ ["--swatch" as string]: value }}>
                  <input type="radio" name="ticket-color" value={value} checked={color === value} onChange={() => setColor(value)} />
                  <span aria-hidden="true" />
                  <span className="visually-hidden">カラー {value}</span>
                </label>
              ))}
            </fieldset>
            <button className="button button-primary" type="submit" disabled={busy}><Plus size={18} />チケットを作る</button>
          </form>
        </Panel>
      </section>

      <section className="section-block">
        <div className="section-heading"><div><p className="eyebrow">JOIN</p><h2>参加コードで参加する</h2></div></div>
        <Panel className="ticket-form">
          <form onSubmit={(event) => { event.preventDefault(); void run(async () => { await joinGroup(joinCode); setJoinCode(""); }); }}>
            <label><span>6桁の参加コード</span><input value={joinCode} inputMode="numeric" pattern="[0-9]{6}" maxLength={6} placeholder="123456" onChange={(event) => setJoinCode(event.target.value.replace(/\D/g, ""))} /></label>
            <button className="button button-secondary" type="submit" disabled={busy || joinCode.length !== 6}><TicketIcon size={18} />チケットに参加</button>
          </form>
        </Panel>
      </section>
    </div>
  );
}
