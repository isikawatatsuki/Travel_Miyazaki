import { BedDouble, BookOpen, CalendarDays, Camera, CheckCircle2, CircleDollarSign, Clock3, MapPin, Plane, StickyNote, UsersRound } from "lucide-react";
import { useTrip } from "../TripContext";
import { getScheduleDays } from "../data";
import { getBudgetSummary } from "../derived";
import { mapsSearch, yen } from "../lib";
import { PageHelp, PageLink, Panel, SectionHeading } from "../components/ui";
import { TicketArtwork } from "../components/TicketCard";

export function HomePage() {
  const { tripSettings, schedule, checklist, notes, settlement, adjust, reservations, album, helpOpen, setHelpOpen, activeTicket } = useTrip();
  const budget = getBudgetSummary(adjust, settlement.people.length);
  const days = getScheduleDays(tripSettings);
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
  const checked = checklist.items.filter((item) => item.checked).length;
  const daysLeft = Math.ceil((start.getTime() - today.getTime()) / 86400000);
  const tripStatusLabel = phase === "before" ? "COUNTDOWN" : phase === "during" ? "TODAY" : "TRIP LOG";
  const tripStatusTitle = phase === "before" ? `あと ${daysLeft} 日` : phase === "during" ? "旅の途中" : "思い出を見返す";
  const tripPeopleLabel = phase === "after" ? `${settlement.people.length}人の旅の記録` : `${settlement.people.length}人で行く旅`;
  const scheduleTitle = phase === "during" ? "今日の予定" : phase === "after" ? "旅の記録" : "最初の日の予定";
  const now = new Date();
  const nowTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const nextItem = displayItems.find((item) => !item.isTimeUnset && item.time >= nowTime) || displayItems[0];
  return (
    <div className="page home-page">
      <PageHelp open={helpOpen} onChange={setHelpOpen}>
        <p>ここは確認専用です。編集は下のタブから。人数と1人あたりの金額は共有ページのメンバーが基準です。</p>

        <p className="page-help-lead">旅の地図に行った場所を並べるには</p>
        <ol>
          <li><b>予定</b>を開き、右上の「予定を設定」を押す</li>
          <li>各予定の<b>場所</b>からアプリ内の地図を開く</li>
          <li>ピンを置いて、場所の名前を付ければ登録完了</li>
        </ol>
        <p>
          URLを用意する必要はありません。地図のタップ、ピン移動、現在地から選べます。
          並ぶ順番は日付と時刻の順で、経路に出したくない予定は「旅の経路に含める」のチェックを外します。
        </p>
        <p>場所が読み取れなかった予定は経路から外れ、旅の地図でそのチケットを選ぶと名前が一覧で表示されます。</p>
      </PageHelp>
      <header className="dashboard-heading">
        <div><p className="eyebrow">TRIP OVERVIEW</p><h1 id="hero-title">旅の概要</h1><p>{tripSettings.tripName} · {tripSettings.dateLabel}</p></div>
        <span className="dashboard-phase"><i />{tripStatusTitle}</span>
      </header>

      <section className="dashboard-grid" aria-labelledby="hero-title">
        <Panel className="dashboard-ticket-card">
          <div className="dashboard-card-head"><div><span>TRAVEL TICKET</span><strong>旅のチケット</strong></div><a href="#tickets">切り替える</a></div>
          {activeTicket && <TicketArtwork ticket={activeTicket} />}
        </Panel>
        <Panel className="next-card">
          <span>{phase === "during" ? "NEXT SCHEDULE" : phase === "after" ? "TRIP ARCHIVE" : "DEPARTURE"}</span>
          <div className="next-time">{phase === "during" ? nextItem?.time || "--:--" : phase === "after" ? `${album.items.length}枚` : tripSettings.departureTime}</div>
          <strong>{phase === "during" ? nextItem?.title || "予定はありません" : phase === "after" ? "旅の写真を見返す" : "出発時刻"}</strong>
          <p>{nextItem?.memo || tripPeopleLabel}</p>
          <a href={phase === "after" ? "#album" : "#plan"}>詳細を確認</a>
        </Panel>
      </section>

      <section className="quick-grid" aria-label="旅の重要情報">
        <Panel className="quick-card accent-blue"><Plane size={22} aria-hidden="true" /><span>行きの便</span><strong>{tripSettings.outboundLabel}</strong></Panel>
        <Panel className="quick-card accent-pink"><BedDouble size={22} aria-hidden="true" /><span>泊まるところ</span><strong>{tripSettings.hotelName}</strong></Panel>
        <Panel className="quick-card accent-yellow">{phase === "after" ? <Camera size={22} aria-hidden="true" /> : <Clock3 size={22} aria-hidden="true" />}<span>ステータス</span><strong>{tripStatusLabel}</strong></Panel>
      </section>

      <section className="home-overview" aria-label="旅の全体サマリー">
        <a href="#share"><UsersRound size={20} aria-hidden="true" /><span>参加メンバー</span><strong>{budget.peopleCount}人</strong></a>
        <a href="#money"><CircleDollarSign size={20} aria-hidden="true" /><span>1人あたりの目安</span><strong>{yen.format(budget.perPerson)}</strong></a>
        <a href="#plan"><CalendarDays size={20} aria-hidden="true" /><span>登録した予定</span><strong>{schedule.items.length}件</strong></a>
      </section>

      <section className="section-block">
        <SectionHeading eyebrow={phase === "during" ? "TODAY" : phase === "after" ? "MEMORY" : "DAY 1"} title={scheduleTitle} action={<PageLink href="#plan">予定を見る</PageLink>} />
        <Panel className="timeline-panel">
          {displayItems.length ? displayItems.map((item) => (
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
        <a href="#details"><BookOpen aria-hidden="true" /><span>旅の詳細</span><strong>{reservations.items.length + album.items.length}件</strong></a>
      </section>
    </div>
  );
}
