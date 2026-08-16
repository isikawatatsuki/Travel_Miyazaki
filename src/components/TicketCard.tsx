import { Archive, RotateCcw } from "lucide-react";
import { countdownLabel, ticketStatus } from "../tickets";
import type { Ticket } from "../types";
import { TicketStamp } from "./TicketStamp";

const TEMPLATE_URL = "/travel-miyazaki-ticket-template-v5.svg";

function shortDate(date?: string) {
  return date ? date.slice(5).replace("-", ".") : "--.--";
}

function dateRange(startDate?: string, endDate?: string) {
  const year = startDate?.slice(0, 4);
  return `${year ? `${year}.` : ""}${shortDate(startDate)} – ${shortDate(endDate)}`;
}

export function TicketCard({ ticket, active, onOpen, onArchive, onRestore }: {
  ticket: Ticket;
  active: boolean;
  onOpen: () => void;
  onArchive: () => void;
  onRestore: () => void;
}) {
  const status = ticketStatus(ticket);
  const settings = ticket.state.tripSettings || {};
  const members = ticket.state.settlement?.people?.length || 0;
  const stamped = status === "done" || status === "archived";
  const stampDate = (settings.endDate || "").replaceAll("-", ".") || "----.--.--";
  const statusText = `${countdownLabel(ticket)}${ticket.groupId ? " · 共有中" : ""}`;

  return (
    <article className={`ticket is-${status} ${active ? "is-active" : ""}`} style={{ ["--ticket" as string]: ticket.themeColor }}>
      <button className="ticket-open" type="button" onClick={onOpen} aria-label={`${ticket.name || "名称未設定の旅"}を開く`}>
        <span className="ticket-art">
          <img className="ticket-template" src={TEMPLATE_URL} alt="" aria-hidden="true" />
          <strong className="ticket-dynamic ticket-journey">{ticket.name || "名称未設定の旅"}</strong>
          <strong className="ticket-dynamic ticket-from">{settings.mapOrigin || "出発地未設定"}</strong>
          <strong className="ticket-dynamic ticket-to">{settings.mapDestination || "目的地未設定"}</strong>
          <span className="ticket-dynamic ticket-date">{dateRange(settings.startDate, settings.endDate)}</span>
          <span className="ticket-dynamic ticket-party">{String(members).padStart(2, "0")}名</span>
          <span className="ticket-dynamic ticket-status-value">{statusText}</span>
          <span className="ticket-dynamic ticket-stub-date">{shortDate(settings.startDate)}</span>
          <span className="ticket-dynamic ticket-stub-party">{String(members).padStart(2, "0")}名</span>
          {stamped && <TicketStamp status={status} date={stampDate} />}
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
