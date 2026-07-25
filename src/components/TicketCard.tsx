import { Archive, CalendarDays, CheckCircle2, Plane, Users } from "lucide-react";
import { countdownLabel, STATUS_LABELS, ticketStatus } from "../tickets";
import type { Ticket, TicketStatus } from "../types";

const STATUS_ICONS: Record<TicketStatus, typeof Plane> = {
  planning: CalendarDays,
  traveling: Plane,
  done: CheckCircle2,
  archived: Archive,
};

/** 券面の日付は「2026.09.21」ではなく「09.21」まで落とし、年は別に小さく置く。 */
function short(date?: string) {
  return date ? date.slice(5).replace("-", ".") : "--.--";
}

export function TicketCard({ ticket, onOpen, active = false }: { ticket: Ticket; onOpen: () => void; active?: boolean }) {
  const status = ticketStatus(ticket);
  const StatusIcon = STATUS_ICONS[status];
  const settings = ticket.state.tripSettings || {};
  const members = ticket.state.settlement?.people?.length || 0;
  const year = settings.startDate?.slice(0, 4) || "";
  const stamped = status === "done" || status === "archived";

  return (
    <article className={`ticket is-${status} ${active ? "is-active" : ""}`} style={{ ["--ticket" as string]: ticket.themeColor }}>
      {/* button に直接 grid を敷くと iOS Safari で子が高さいっぱいに伸びない。
          レイアウトは必ず内側の span 側で組む。 */}
      <button className="ticket-open" type="button" onClick={onOpen}>
      <span className="ticket-inner">
        {/* 半券。券面の左端を縦に走り、状態をここで宣言する。 */}
        <span className="ticket-stub">
          <span className="ticket-stub-status">
            <StatusIcon size={13} aria-hidden="true" />
            {STATUS_LABELS[status]}
          </span>
        </span>

        <span className="ticket-face">
          <span className="ticket-route">
            <span className="ticket-place">
              <small>FROM</small>
              <strong>{settings.mapOrigin || "出発地未設定"}</strong>
            </span>
            <span className="ticket-arrow" aria-hidden="true" />
            <span className="ticket-place">
              <small>TO</small>
              <strong>{settings.mapDestination || "目的地未設定"}</strong>
            </span>
          </span>

          <span className="ticket-name">{ticket.name || "名称未設定の旅"}</span>

          <span className="ticket-data">
            <span className="ticket-data-cell">
              <small>DATE</small>
              <b>{short(settings.startDate)}<i aria-hidden="true">–</i>{short(settings.endDate)}</b>
              {year && <u>{year}</u>}
            </span>
            <span className="ticket-data-cell">
              <small>PARTY</small>
              <b>{String(members).padStart(2, "0")}<i aria-hidden="true">名</i></b>
              <u><Users size={11} aria-hidden="true" />メンバー</u>
            </span>
            {/* 旅を終えた券はスタンプが状態を語るので、STATUS 欄は重ねて置かない。
                空いた右下にスタンプが収まり、経路の文字とも衝突しない。 */}
            {!stamped && (
              <span className="ticket-data-cell is-wide">
                <small>STATUS</small>
                <b className="ticket-countdown">{countdownLabel(ticket)}</b>
                {ticket.groupId && <u>共有中</u>}
              </span>
            )}
            {stamped && ticket.groupId && (
              <span className="ticket-data-cell is-wide"><u>共有中</u></span>
            )}
          </span>
        </span>

        {/* 旅を終えた券に押される入国スタンプ。状態を色ではなく文字と意匠で伝える。 */}
        {stamped && (
          <span className="ticket-stamp" aria-hidden="true">
            <b>{status === "done" ? "ARRIVED" : "ARCHIVED"}</b>
            <em>{(settings.endDate || "").replaceAll("-", ".") || "----.--.--"}</em>
            <i>TABILOG</i>
          </span>
        )}
      </span>
      </button>
    </article>
  );
}
