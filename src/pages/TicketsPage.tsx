import { useState } from "react";
import { Map, Plus, TicketCheck, Ticket as TicketIcon } from "lucide-react";
import { useTrip } from "../TripContext";
import { sortTickets, ticketStatus } from "../tickets";
import { TicketCard } from "../components/TicketCard";
import { EmptyState, Panel } from "../components/ui";
import { AboutDeveloper } from "../components/AboutDeveloper";
import { NewTicketDialog, type NewTicket } from "../components/NewTicketDialog";

export function TicketsPage({ onOpenTicket }: { onOpenTicket: (id: string) => void }) {
  const { trips, activeTripId, createTrip, switchTrip, archiveTrip, restoreTrip, joinGroup } = useTrip();
  const [newOpen, setNewOpen] = useState(false);
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
      <section className="section-block" aria-labelledby="ticket-list-title">
        {/* 券そのものが見出しの役割を果たすので、見出しは支援技術にだけ残す。 */}
        <h1 id="ticket-list-title" className="visually-hidden">チケット一覧</h1>

        <nav className="tickets-actions" aria-label="チケットの操作">
          <button className="button button-primary" type="button" onClick={() => setNewOpen(true)}><Plus size={18} aria-hidden="true" />チケットを発行</button>
          <a className="button button-secondary" href="#map"><Map size={18} aria-hidden="true" />旅の地図を見る</a>
          {archivedCount > 0 && (
            <button className="button button-quiet small" type="button" aria-pressed={showArchived} onClick={() => setShowArchived((current) => !current)}>
              アーカイブ{showArchived ? "を隠す" : `を表示（${archivedCount}）`}
            </button>
          )}
        </nav>

        {message && <p className="tickets-error" role="alert">{message}</p>}

        {visible.length ? (
          <ul className="ticket-list">
            {visible.map((ticket) => (
              <li key={ticket.id}>
                <TicketCard
                  ticket={ticket}
                  active={ticket.id === activeTripId}
                  onOpen={() => void open(ticket.id)}
                  onArchive={() => void archiveTrip(ticket.id)}
                  onRestore={() => restoreTrip(ticket.id)}
                />
              </li>
            ))}
          </ul>
        ) : (
          <Panel className="tickets-empty">
            <TicketCheck size={36} aria-hidden="true" />
            <strong>チケットはまだありません</strong>
            <EmptyState>上の「チケットを発行」から旅を始めましょう。友だちからコードをもらっているなら、下の「参加コードで参加する」から参加できます。</EmptyState>
          </Panel>
        )}
      </section>

      <details className="ticket-fold">
        <summary><TicketIcon size={18} aria-hidden="true" />参加コードで参加する</summary>
        <Panel className="ticket-form">
          <form onSubmit={(event) => { event.preventDefault(); void run(async () => { await joinGroup(joinCode); setJoinCode(""); }); }}>
            <label><span>6桁の参加コード</span><input value={joinCode} inputMode="numeric" pattern="[0-9]{6}" maxLength={6} placeholder="123456" onChange={(event) => setJoinCode(event.target.value.replace(/\D/g, ""))} /></label>
            <button className="button button-secondary" type="submit" disabled={busy || joinCode.length !== 6}><TicketIcon size={18} />チケットに参加</button>
          </form>
        </Panel>
      </details>

      <NewTicketDialog
        open={newOpen}
        busy={busy}
        onClose={() => setNewOpen(false)}
        onCreate={(ticket: NewTicket) => void run(async () => {
          const id = await createTrip(ticket.name, ticket.themeColor, {
            startDate: ticket.startDate, endDate: ticket.endDate,
            originUrl: ticket.origin.url, originLabel: ticket.origin.label, originLat: ticket.origin.lat, originLng: ticket.origin.lng,
            destinationUrl: ticket.destination.url, destinationLabel: ticket.destination.label, destinationLat: ticket.destination.lat, destinationLng: ticket.destination.lng,
          });
          setNewOpen(false);
          if (id) onOpenTicket(id);
        })}
      />

      <AboutDeveloper />
    </div>
  );
}
