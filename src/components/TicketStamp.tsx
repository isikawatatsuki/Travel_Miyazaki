import type { TicketStatus } from "../types";

export function TicketStamp({ status, date }: { status: Extract<TicketStatus, "done" | "archived">; date: string }) {
  const label = status === "done" ? "ARRIVED" : "ARCHIVED";
  const readableStatus = status === "done" ? "到着済み" : "アーカイブ済み";

  return (
    <svg className={`ticket-svg-stamp is-${status}`} viewBox="0 0 180 180" role="img" aria-label={`${readableStatus} ${date}`}>
      <circle cx="90" cy="90" r="78" fill="none" stroke="currentColor" strokeWidth="5" />
      <circle cx="90" cy="90" r="68" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="4 5" />
      <path d="M28 70h124M28 113h124" fill="none" stroke="currentColor" strokeWidth="3" />
      <text x="90" y="61" textAnchor="middle" className="ticket-stamp-brand">TABILOG</text>
      <text x="90" y="99" textAnchor="middle" className="ticket-stamp-label">{label}</text>
      <text x="90" y="132" textAnchor="middle" className="ticket-stamp-date">{date}</text>
      <path d="M90 19l5 9 10 2-7 8 1 10-9-4-9 4 1-10-7-8 10-2z" fill="currentColor" />
    </svg>
  );
}
