import { useMemo, useState } from "react";
import { Archive, ArrowLeft, CalendarDays, CheckCircle2, Images, MapPin, NotebookPen, Plane, Users } from "lucide-react";
import { useTrip } from "../TripContext";
import { buildTicketRoute, sortTickets, STATUS_LABELS, ticketStatus } from "../tickets";
import { RouteMap, type MapRoute } from "../components/RouteMap";
import { EmptyState, Panel } from "../components/ui";
import type { PageKey } from "../types";

const STATUS_ICONS = {
  planning: CalendarDays,
  traveling: Plane,
  done: CheckCircle2,
  archived: Archive,
};

export function TravelMapPage({ onOpenTicket }: { onOpenTicket: (id: string, target?: PageKey) => void }) {
  const { trips, switchTrip } = useTrip();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // 全体表示は「完了した旅」を集約する。計画中の旅まで出すと、まだ行っていない
  // 経路が思い出の地図に混ざってしまうため。選択時は状態を問わず表示する。
  const withRoutes = useMemo(() => sortTickets(trips)
    .map((ticket) => ({ ticket, route: buildTicketRoute(ticket.state), status: ticketStatus(ticket) }))
    .filter((entry) => entry.route.points.length > 0), [trips]);

  const overview = withRoutes.filter((entry) => entry.status === "done");
  const listed = overview.length ? overview : withRoutes;

  const routes: MapRoute[] = useMemo(() => (selectedId ? withRoutes : listed)
    .map(({ ticket, route }) => ({ id: ticket.id, name: ticket.name, color: ticket.themeColor, points: route.points })),
    [listed, selectedId, withRoutes]);

  const selected = withRoutes.find((entry) => entry.ticket.id === selectedId) || null;

  const open = async (id: string, target?: PageKey) => { await switchTrip(id); onOpenTicket(id, target); };

  return (
    <div className="page travel-map-page">
      <header className="map-page-head ticket-page-head">
        <a className="button button-quiet small" href="#tickets"><ArrowLeft size={17} aria-hidden="true" />チケット一覧</a>
        <div>
          <p className="eyebrow">TRAVEL MAP</p>
          <h1>旅の地図</h1>
        </div>
      </header>

      {withRoutes.length === 0 ? (
        <Panel className="tickets-empty">
          <MapPin size={34} aria-hidden="true" />
          <strong>まだ経路がありません</strong>
          <EmptyState>予定に地図リンクを貼るか緯度経度を入れると、その場所が地図に並びます。予定ごとに「旅の経路に含める」で調整できます。</EmptyState>
        </Panel>
      ) : (
        <div className="map-layout">
          <div className="map-canvas">
            <RouteMap routes={routes} selectedId={selectedId} />
            <p className="map-attribution">© OpenStreetMap contributors / OpenFreeMap</p>
          </div>

          <aside className="map-side" aria-label="チケットの選択">
            <div className="map-side-head">
              <button className="button button-quiet small" type="button" onClick={() => setSelectedId(null)} aria-pressed={selectedId === null}>
                すべての旅行
              </button>
              <p>{selectedId ? "選んだ旅の経路だけを表示しています。" : `${listed.length}件の経路を同じ色で重ねています。`}</p>
            </div>

            <ul className="map-ticket-list">
              {withRoutes.map(({ ticket, route, status }) => {
                const StatusIcon = STATUS_ICONS[status];
                return (
                  <li key={ticket.id}>
                    <button
                      type="button"
                      className={`map-ticket ${selectedId === ticket.id ? "is-selected" : ""}`}
                      style={{ ["--ticket" as string]: ticket.themeColor }}
                      aria-pressed={selectedId === ticket.id}
                      onClick={() => setSelectedId((current) => current === ticket.id ? null : ticket.id)}
                    >
                      <span className="map-ticket-color" aria-hidden="true" />
                      <span>
                        <strong>{ticket.name || "名称未設定の旅"}</strong>
                        <small><StatusIcon size={13} aria-hidden="true" />{route.points.length}地点・{STATUS_LABELS[status]}</small>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            {selected && (
              <div className="map-detail" style={{ ["--ticket" as string]: selected.ticket.themeColor }}>
                <h2>{selected.ticket.name || "名称未設定の旅"}</h2>
                <p className="map-detail-dates">
                  {selected.ticket.state.tripSettings?.startDate?.replaceAll("-", ".") || "日程未設定"}
                  {" → "}
                  {selected.ticket.state.tripSettings?.endDate?.replaceAll("-", ".") || ""}
                </p>
                <p className="map-detail-members">
                  <Users size={15} aria-hidden="true" />
                  {(selected.ticket.state.settlement?.people || []).map((person) => person.name).join("、") || "メンバー未登録"}
                </p>

                <ol className="map-detail-points">
                  {selected.route.points.map((point, index) => (
                    <li key={point.id}><span aria-hidden="true">{index + 1}</span>{point.title}</li>
                  ))}
                </ol>

                {selected.route.skipped.length > 0 && (
                  <p className="map-detail-skipped">
                    場所が分からないため経路から外した予定：{selected.route.skipped.join("、")}
                  </p>
                )}

                <div className="map-detail-links">
                  <button className="button button-secondary small" type="button" onClick={() => void open(selected.ticket.id, "album")}>
                    <Images size={16} aria-hidden="true" />写真を見る
                  </button>
                  <button className="button button-secondary small" type="button" onClick={() => void open(selected.ticket.id, "share")}>
                    <NotebookPen size={16} aria-hidden="true" />共有メモを見る
                  </button>
                  <button className="button button-quiet small" type="button" onClick={() => void open(selected.ticket.id)}>
                    このチケットを開く
                  </button>
                </div>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
