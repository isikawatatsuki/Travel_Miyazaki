import { BedDouble, BookOpen, CalendarDays, Camera, CheckCircle2, CircleDollarSign, Clock3, MapPin, Plane, StickyNote, UsersRound } from "lucide-react";
import { useMemo } from "react";
import { useTrip } from "../TripContext";
import { getScheduleDays } from "../data";
import { getBudgetSummary } from "../derived";
import { mapsSearch, yen } from "../lib";
import { buildTicketRoute } from "../tickets";
import { PageHelp, PageLink, Panel, SectionHeading } from "../components/ui";
import { HeroRouteMap } from "../components/HeroRouteMap";

export function HomePage() {
  const { tripSettings, schedule, checklist, notes, settlement, adjust, reservations, album, helpOpen, setHelpOpen } = useTrip();
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
  // 背景地図は予定から作った経路をそのまま描く。予定に座標が無ければ
  // buildTicketRoute が旅行設定の出発地・目的地へ落ちる。
  const heroRoute = useMemo(() => buildTicketRoute({ tripSettings, schedule } as Parameters<typeof buildTicketRoute>[0]), [schedule, tripSettings]);

  return (
    <div className="page home-page">
      <PageHelp open={helpOpen} onChange={setHelpOpen}>
        <p>ここは確認専用です。編集は下のタブから。人数と1人あたりの金額は共有ページのメンバーが基準です。</p>

        <p className="page-help-lead">旅の地図に行った場所を並べるには</p>
        <ol>
          <li><b>予定</b>を開き、右上の「予定を設定」を押す</li>
          <li>各予定の<b>地図URL</b>に、Googleマップのリンクを貼る</li>
          <li>下の表示が「地図に表示できます」に変われば取り込み完了</li>
        </ol>
        <p>並ぶ順番は日付と時刻の順です。経路に出したくない予定は「旅の経路に含める」のチェックを外します。</p>

        <p className="page-help-lead">貼っても認識されないとき</p>
        <p>
          共有ボタンで出る短縮URL（<code>maps.app.goo.gl/…</code>）は座標を持たないため使えません。
          ブラウザのアドレスバーに出ている長いURL（<code>google.com/maps/@35.68,139.76…</code>）を貼るか、
          予定ごとに表示される緯度・経度の欄へ直接入力してください。
        </p>
        <p>場所が分からなかった予定は経路から外れ、旅の地図でそのチケットを選ぶと名前が一覧で表示されます。</p>
      </PageHelp>
      <section className="hero-section" aria-labelledby="hero-title">
        <HeroRouteMap points={heroRoute.points} />
        {(tripSettings.originCode || tripSettings.destinationCode) && (
          <div className="hero-route" aria-hidden="true">
            <span>{tripSettings.originCode}</span><i /><Plane size={26} /><i /><span>{tripSettings.destinationCode}</span>
          </div>
        )}
        <p className="eyebrow">{tripSettings.dateLabel}</p>
        <h1 id="hero-title">{tripSettings.tripName}</h1>
        <p className="hero-destination">{tripSettings.routeLabel}</p>
        <div className="trip-note-ticket">
          <span>{tripStatusLabel}</span>
          <strong>{tripStatusTitle}</strong>
          <small>{tripPeopleLabel}</small>
        </div>
      </section>

      <section className="quick-grid" aria-label="旅の重要情報">
        <Panel className="quick-card accent-yellow">
          {phase === "after" ? <Camera size={22} aria-hidden="true" /> : <Clock3 size={22} aria-hidden="true" />}
          <span>{phase === "during" ? nextItem ? `次の予定 ${nextItem.time}` : "今日の予定" : phase === "after" ? "アルバム" : "家を出る"}</span>
          <strong>{phase === "during" ? nextItem?.title || "予定なし" : phase === "after" ? `${album.items.length}枚の思い出` : tripSettings.departureTime}</strong>
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
