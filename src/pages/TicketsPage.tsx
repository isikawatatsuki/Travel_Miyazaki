import { Plus, Ticket as TicketIcon, TicketCheck } from "lucide-react";
import { useCallback, useState } from "react";
import { NewTicketDialog, type NewTicketInput } from "../components/NewTicketDialog";
import { TicketCard } from "../components/TicketCard";
import { EmptyState, Panel, SectionHeading } from "../components/ui";
import { useTrip } from "../TripContext";
import { sortTickets, ticketStatus } from "../tickets";

export function TicketsPage({ onOpenTicket }: { onOpenTicket: (id: string) => void }) {
  const { trips, activeTripId, createTrip, switchTrip, archiveTrip, restoreTrip, joinGroup } = useTrip();
  const [newOpen, setNewOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const closeNew = useCallback(() => setNewOpen(false), []);
  const sorted = sortTickets(trips);
  const archivedCount = sorted.filter((ticket) => ticketStatus(ticket) === "archived").length;
  const visible = sorted.filter((ticket) => showArchived || ticketStatus(ticket) !== "archived");

  const run = async <T,>(action: () => Promise<T>) => {
    setBusy(true); setMessage("");
    try { return await action(); } catch (error) { setMessage(error instanceof Error ? error.message : "操作できませんでした。"); return undefined; } finally { setBusy(false); }
  };
  const openTicket = async (id: string) => {
    await switchTrip(id);
    onOpenTicket(id);
  };

  return (
    <div className="page tickets-page">
      <section className="section-block">
        <SectionHeading eyebrow="TRAVEL TICKETS" title="旅のチケット" description="旅行ごとに予定・お金・持ち物・共有先をまとめて管理します。" action={<button className="button button-primary" type="button" onClick={() => setNewOpen(true)}><Plus size={18} />チケットを発行</button>} />
        <div className="tickets-toolbar">
          <p>{visible.length}枚のチケット</p>
          {archivedCount > 0 && <button className="button button-quiet small" type="button" aria-pressed={showArchived} onClick={() => setShowArchived((current) => !current)}>{showArchived ? "アーカイブを隠す" : `アーカイブを表示（${archivedCount}）`}</button>}
        </div>
        {message && <p className="tickets-message" role="alert">{message}</p>}
        {visible.length ? <ul className="ticket-list">{visible.map((ticket) => <li key={ticket.id}><TicketCard ticket={ticket} active={ticket.id === activeTripId} onOpen={() => void openTicket(ticket.id)} onArchive={() => void archiveTrip(ticket.id)} onRestore={() => restoreTrip(ticket.id)} /></li>)}</ul> : <Panel className="tickets-empty"><TicketCheck size={38} aria-hidden="true" /><strong>チケットはまだありません</strong><EmptyState>「チケットを発行」から新しい旅を作るか、参加コードで共有中の旅へ参加できます。</EmptyState></Panel>}
      </section>

      <details className="ticket-join-fold"><summary><TicketIcon size={18} aria-hidden="true" />参加コードで参加する</summary><Panel><form onSubmit={(event) => { event.preventDefault(); void run(async () => { const id = await joinGroup(joinCode); setJoinCode(""); if (id) onOpenTicket(id); }); }}><label><span>6桁の参加コード</span><input value={joinCode} inputMode="numeric" pattern="[0-9]{6}" maxLength={6} placeholder="123456" onChange={(event) => setJoinCode(event.target.value.replace(/\D/g, ""))} /></label><button className="button button-secondary" type="submit" disabled={busy || joinCode.length !== 6}><TicketIcon size={18} />チケットに参加</button></form></Panel></details>

      <NewTicketDialog open={newOpen} busy={busy} onClose={closeNew} onCreate={(input: NewTicketInput) => void run(async () => { const id = await createTrip(input); closeNew(); onOpenTicket(id); })} />
    </div>
  );
}
