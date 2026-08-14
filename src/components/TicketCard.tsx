import { Archive, CalendarDays, CheckCircle2, Plane, RotateCcw, Users } from "lucide-react";
import { countdownLabel, STATUS_LABELS, ticketStatus } from "../tickets";
import type { Ticket, TicketStatus } from "../types";

const STATUS_ICONS: Record<TicketStatus, typeof Plane> = {
  planning: CalendarDays,
  traveling: Plane,
  done: CheckCircle2,
  archived: Archive,
};

function shortDate(date?: string) {
  return date ? date.slice(5).replace("-", ".") : "--.--";
}

export function TicketCard({ ticket, active, onOpen, onArchive, onRestore }: {
  ticket: Ticket;
  active: boolean;
  onOpen: () => void;
  onArchive: () => void;
  onRestore: () => void;
}) {
  const status = ticketStatus(ticket);
  const StatusIcon = STATUS_ICONS[status];
  const settings = ticket.state.tripSettings;
  const members = ticket.state.settlement.people.length;

  return (
    <article className={`travel-ticket is-${status} ${active ? "is-active" : ""}`} style={{ ["--ticket-color" as string]: ticket.themeColor }}>
      <button className="travel-ticket-open" type="button" onClick={onOpen}>
        <span className="travel-ticket-stub"><StatusIcon size={17} aria-hidden="true" /><strong>{STATUS_LABELS[status]}</strong></span>
        <span className="travel-ticket-face">
          <span className="travel-ticket-route"><small>FROM</small><strong>{settings.mapOrigin || "出発地未設定"}</strong><i aria-hidden="true" /><small>TO</small><strong>{settings.mapDestination || "目的地未設定"}</strong></span>
          <span className="travel-ticket-name">{ticket.name}</span>
          <span className="travel-ticket-data">
            <span><small>DATE</small><strong>{shortDate(settings.startDate)} – {shortDate(settings.endDate)}</strong></span>
            <span><small>PARTY</small><strong><Users size={14} aria-hidden="true" />{members}名</strong></span>
            <span><small>STATUS</small><strong>{countdownLabel(ticket)}</strong></span>
          </span>
        </span>
      </button>
      <div className="travel-ticket-actions">
        {active && status !== "archived" && <span>現在開いているチケット</span>}
        {status === "archived"
          ? <button className="button button-quiet small" type="button" onClick={onRestore}><RotateCcw size={16} />戻す</button>
          : <button className="button button-quiet small" type="button" onClick={onArchive}><Archive size={16} />アーカイブ</button>}
      </div>
    </article>
  );
}
