import { BedDouble, CalendarDays, CheckCircle2, CircleDollarSign, Clock3, MapPin, Plane, StickyNote, UsersRound } from "lucide-react";
import { useTrip } from "../TripContext";
import { getScheduleDays } from "../data";
import { getBudgetSummary } from "../derived";
import { mapsSearch, yen } from "../lib";
import { PageLink, Panel, SectionHeading } from "../components/ui";

export function HomePage() {
  const { tripSettings, schedule, checklist, notes, settlement, adjust } = useTrip();
  const budget = getBudgetSummary(adjust, settlement.people.length);
  const days = getScheduleDays(tripSettings);
  const firstDay = days[0]?.id;
  const firstDayItems = schedule.items
    .filter((item) => item.day === firstDay)
    .sort((a, b) => (a.isTimeUnset ? "99:99" : a.time).localeCompare(b.isTimeUnset ? "99:99" : b.time));
  const checked = checklist.items.filter((item) => item.checked).length;
  const start = new Date(`${tripSettings.startDate}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysLeft = Math.ceil((start.getTime() - today.getTime()) / 86400000);

  return (
    <div className="page home-page">
      <section className="hero-section" aria-labelledby="hero-title">
        <div className="hero-route" aria-hidden="true">
          <span>OSA</span><i /><Plane size={26} /><i /><span>MIY</span>
        </div>
        <p className="eyebrow">{tripSettings.dateLabel}</p>
        <h1 id="hero-title">{tripSettings.tripName}</h1>
        <p className="hero-destination">{tripSettings.routeLabel}</p>
        <div className="trip-note-ticket">
          <span>Trip Note</span>
          <strong>{daysLeft > 0 ? `あと ${daysLeft} 日` : daysLeft === 0 ? "今日から！" : "思い出の旅"}</strong>
          <small>{settlement.people.length}人で行く旅</small>
        </div>
      </section>

      <section className="quick-grid" aria-label="旅の重要情報">
        <Panel className="quick-card accent-yellow">
          <Clock3 size={22} aria-hidden="true" /><span>家を出る</span><strong>{tripSettings.departureTime}</strong>
        </Panel>
        <Panel className="quick-card accent-blue">
          <Plane size={22} aria-hidden="true" /><span>行きの便</span><strong>{tripSettings.outboundLabel}</strong>
        </Panel>
        <Panel className="quick-card accent-pink">
          <BedDouble size={22} aria-hidden="true" /><span>泊まるところ</span><strong>{tripSettings.hotelName}</strong>
        </Panel>
      </section>

      <section className="home-overview" aria-label="旅の全体サマリー">
        <a href="#share"><UsersRound size={20} aria-hidden="true" /><span>参加メンバー</span><strong>{budget.peopleCount}人</strong></a>
        <a href="#money"><CircleDollarSign size={20} aria-hidden="true" /><span>1人あたりの目安</span><strong>{yen.format(budget.perPerson)}</strong></a>
        <a href="#plan"><CalendarDays size={20} aria-hidden="true" /><span>登録した予定</span><strong>{schedule.items.length}件</strong></a>
      </section>

      <section className="section-block">
        <SectionHeading eyebrow="DAY 1" title="最初の日の予定" action={<PageLink href="#plan">予定を編集</PageLink>} />
        <Panel className="timeline-panel">
          {firstDayItems.length ? firstDayItems.map((item) => (
            <div className="timeline-row" key={item.id}>
              <time>{item.isTimeUnset ? "未定" : item.time}</time>
              <div><strong>{item.title || "予定名なし"}</strong>{item.memo && <p>{item.memo}</p>}</div>
            </div>
          )) : <p className="empty-state">予定はまだありません。</p>}
        </Panel>
      </section>

      <section className="section-block">
        <SectionHeading eyebrow="STAY" title="泊まるところ" />
        <Panel className="stay-summary">
          <div className="stay-icon"><MapPin size={24} aria-hidden="true" /></div>
          <div><strong>{tripSettings.hotelName}</strong><p>{tripSettings.hotelAddress}</p></div>
          <a className="button button-secondary" href={mapsSearch(`${tripSettings.hotelName} ${tripSettings.hotelAddress}`)} target="_blank" rel="noreferrer">地図</a>
        </Panel>
      </section>

      <section className="status-strip" aria-label="準備の進み具合">
        <a href="#packing"><CheckCircle2 aria-hidden="true" /><span>持ち物</span><strong>{checked}/{checklist.items.length}</strong></a>
        <a href="#share"><StickyNote aria-hidden="true" /><span>共有メモ</span><strong>{notes.items.length}件</strong></a>
        <a href="#plan"><CalendarDays aria-hidden="true" /><span>旅程</span><strong>{schedule.items.length}件</strong></a>
      </section>
    </div>
  );
}
