import { Archive, CalendarDays, CheckCircle2, MapPin, Plane, Users } from "lucide-react";
import { countdownLabel, STATUS_LABELS, ticketStatus } from "../tickets";
import type { Ticket, TicketStatus } from "../types";

const STATUS_ICONS: Record<TicketStatus, typeof Plane> = {
  planning: CalendarDays,
  traveling: Plane,
  done: CheckCircle2,
  archived: Archive,
};

function dateRange(ticket: Ticket) {
  const { startDate, endDate } = ticket.state.tripSettings || {};
  if (!startDate || !endDate) return "日程未設定";
  return `${startDate.replaceAll("-", ".")} → ${endDate.replaceAll("-", ".")}`;
}

export function TicketCard({ ticket, onOpen, active = false }: { ticket: Ticket; onOpen: () => void; active?: boolean }) {
  const status = ticketStatus(ticket);
  const StatusIcon = STATUS_ICONS[status];
  const settings = ticket.state.tripSettings || {};
  const members = ticket.state.settlement?.people?.length || 0;

  return (
    <article className={`ticket is-${status} ${active ? "is-active" : ""}`} style={{ ["--ticket" as string]: ticket.themeColor }}>
      <button className="ticket-open" type="button" onClick={onOpen}>
        <span className="ticket-stub" aria-hidden="true">
          <span className="ticket-stub-mark">TRAVEL<br />TICKET</span>
        </span>
        <span className="ticket-body">
          <span className="ticket-top">
            <span className="ticket-status">
              <StatusIcon size={14} aria-hidden="true" />
              {STATUS_LABELS[status]}
            </span>
            <span className="ticket-countdown">{countdownLabel(ticket)}</span>
          </span>

          <span className="ticket-name">{ticket.name || "名称未設定の旅"}</span>

          <span className="ticket-route">
            <MapPin size={14} aria-hidden="true" />
            {settings.mapOrigin || "出発地未設定"}
            <i aria-hidden="true">→</i>
            {settings.mapDestination || "目的地未設定"}
          </span>

          <span className="ticket-meta">
            <span><CalendarDays size={14} aria-hidden="true" />{dateRange(ticket)}</span>
            <span><Users size={14} aria-hidden="true" />{members}人</span>
            {ticket.groupId && <span className="ticket-shared">共有中</span>}
          </span>
        </span>
      </button>
    </article>
  );
}
