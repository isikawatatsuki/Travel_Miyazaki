import { ArrowRight, CheckCircle2, CircleDollarSign, Hotel, MapPin } from "lucide-react";
import { useTrip } from "../TripContext";
import { getScheduleDays } from "../data";
import { getBudgetSummary } from "../derived";
import { mapsSearch, yen } from "../lib";
import { Panel } from "../components/ui";
import { TicketArtwork } from "../components/TicketCard";

export function HomePage() {
  const { tripSettings, schedule, checklist, settlement, adjust, activeTicket } = useTrip();
  const days = getScheduleDays(tripSettings);
  const budget = getBudgetSummary(adjust, settlement.people.length);
  const start = new Date(`${tripSettings.startDate}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const localDate = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, "0"), String(today.getDate()).padStart(2, "0")].join("-");
  const end = new Date(`${tripSettings.endDate}T23:59:59`);
  const phase = today < start ? "before" : today <= end ? "during" : "after";
  const displayDay = phase === "during" && days.some((day) => day.id === localDate) ? localDate : days[0]?.id;
  const displayItems = schedule.items
    .filter((item) => item.day === displayDay)
    .sort((a, b) => (a.isTimeUnset ? "99:99" : a.time).localeCompare(b.isTimeUnset ? "99:99" : b.time));
  const now = new Date();
  const nowTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const nextItem = displayItems.find((item) => !item.isTimeUnset && item.time >= nowTime) || displayItems[0];
  const checked = checklist.items.filter((item) => item.checked).length;
  const origin = tripSettings.mapOrigin || tripSettings.originCode || "出発地";
  const destination = tripSettings.mapDestination || tripSettings.destinationCode || "目的地";
  const routeTitle = `${origin}から${destination}へ`;
  const dayLabel = days.find((day) => day.id === displayDay)?.label || tripSettings.dateLabel;

  return (
    <div className="page home-page webapp-home">
      <header className="webapp-page-head">
        <div>
          <p>{tripSettings.dateLabel}・{settlement.people.length}名</p>
          <h1>{routeTitle}</h1>
        </div>
        <div className="webapp-page-actions">
          <a className="button button-secondary" href="#share">共有</a>
          <a className="button button-primary" href="#plan">予定を追加</a>
        </div>
      </header>

      <div className="home-dashboard">
        <Panel className="webapp-ticket-panel">
          <div className="webapp-panel-head">
            <h2>選択中のチケット</h2>
            <a href="#tickets">チケット一覧</a>
          </div>
          {activeTicket && <TicketArtwork ticket={activeTicket} />}
          <div className="webapp-ticket-toolbar">
            <span>現在開いているチケット</span>
            <a href="#tickets">チケットを切り替える</a>
          </div>
        </Panel>

        <Panel className="webapp-next-panel">
          <div className="webapp-panel-head">
            <h2>次の予定</h2>
            <a href="#plan">予定を開く</a>
          </div>
          <span className="webapp-next-label">{dayLabel}</span>
          <time>{nextItem && !nextItem.isTimeUnset ? nextItem.time : "--:--"}</time>
          <h3>{nextItem?.title || "予定はありません"}</h3>
          <p>{nextItem?.memo || "予定ページから、最初の予定を追加できます。"}</p>
          <a className="button" href="#plan">予定を確認する</a>
        </Panel>

        <Panel className="webapp-schedule-panel">
          <div className="webapp-panel-head">
            <h2>最初の日の予定</h2>
            <a href="#plan">すべて見る</a>
          </div>
          <div className="webapp-schedule-list">
            {displayItems.length ? displayItems.slice(0, 5).map((item) => (
              <div className="webapp-schedule-row" key={item.id}>
                <time>{item.isTimeUnset ? "未定" : item.time}</time>
                <i />
                <div><b>{item.title || "予定名なし"}</b>{item.memo && <small>{item.memo}</small>}</div>
                <a href="#plan">詳細</a>
              </div>
            )) : <div className="webapp-schedule-empty"><span>予定はまだありません</span><a href="#plan">最初の予定を追加</a></div>}
          </div>
        </Panel>

        <section className="webapp-utilities" aria-label="旅の確認メニュー">
          <a className="webapp-utility" href="#packing">
            <span className="webapp-utility-icon"><CheckCircle2 size={19} /></span>
            <span><b>持ち物</b><small>旅の準備状況</small></span><strong>{checked}/{checklist.items.length}</strong>
          </a>
          <a className="webapp-utility" href="#money">
            <span className="webapp-utility-icon"><CircleDollarSign size={19} /></span>
            <span><b>お金</b><small>1人あたりの目安</small></span><strong>{yen.format(budget.perPerson)}</strong>
          </a>
          <a className="webapp-utility" href={mapsSearch(`${tripSettings.hotelName} ${tripSettings.hotelAddress}`)} target="_blank" rel="noreferrer">
            <span className="webapp-utility-icon"><Hotel size={19} /></span>
            <span><b>宿泊先</b><small>{tripSettings.hotelName}</small></span><strong><MapPin size={17} /><span className="visually-hidden">地図を開く</span></strong>
          </a>
        </section>
      </div>

    </div>
  );
}
