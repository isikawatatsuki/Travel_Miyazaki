import { useState } from "react";
import { Check, ExternalLink, MapPin, Plus, Settings2, Trash2 } from "lucide-react";
import { useTrip } from "../TripContext";
import { getScheduleDays } from "../data";
import { makeId, mapsDirections, mapsEmbed, mapsSearch, safeExternalUrl } from "../lib";
import type { ScheduleItem } from "../types";
import { EmptyState, IconButton, Panel, SectionHeading } from "../components/ui";

export function PlanPage() {
  const [isEditing, setIsEditing] = useState(false);
  const { tripSettings, schedule, setSchedule } = useTrip();
  const days = getScheduleDays(tripSettings);
  const activeDay = days.some((day) => day.id === schedule.activeDay) ? schedule.activeDay : days[0].id;
  const items = schedule.items
    .filter((item) => item.day === activeDay)
    .sort((a, b) => (a.isTimeUnset ? "99:99" : a.time).localeCompare(b.isTimeUnset ? "99:99" : b.time));

  const updateItem = (id: string, patch: Partial<ScheduleItem>) => {
    setSchedule((current) => ({ ...current, items: current.items.map((item) => item.id === id ? { ...item, ...patch } : item) }));
  };
  const addItem = () => {
    setSchedule((current) => ({ ...current, items: [...current.items, { id: makeId("schedule"), day: activeDay, time: "", title: "", memo: "", mapUrl: "", isTimeUnset: true }] }));
  };
  const deleteItem = (id: string) => setSchedule((current) => ({ ...current, items: current.items.filter((item) => item.id !== id) }));

  return (
    <div className="page plan-page">
      <SectionHeading
        eyebrow="PLAN"
        title="旅の予定"
        description={isEditing ? "変更した内容は、この端末に自動で保存されます。" : "日ごとの流れを、時間順にさくっと確認できます。"}
        action={
          <button className={`button ${isEditing ? "button-primary" : "button-secondary"} plan-edit-toggle`} type="button" aria-pressed={isEditing} onClick={() => setIsEditing((current) => !current)}>
            {isEditing ? <Check size={18} /> : <Settings2 size={18} />}
            {isEditing ? "編集を完了" : "予定を設定"}
          </button>
        }
      />
      <div className="day-tabs" role="tablist" aria-label="旅行日">
        {days.map((day) => <button key={day.id} role="tab" aria-selected={activeDay === day.id} className={activeDay === day.id ? "is-active" : ""} onClick={() => setSchedule((current) => ({ ...current, activeDay: day.id }))}>{day.shortLabel}<small>{day.label.split("（")[1]?.replace("）", "")}</small></button>)}
      </div>

      {isEditing ? (
        <div className="schedule-editor">
          {items.length ? items.map((item, index) => (
            <Panel className="schedule-card" key={item.id}>
              <div className="schedule-card-head">
                <span className="step-number">{String(index + 1).padStart(2, "0")}</span>
                <label className="time-field"><span>時間</span><input type="time" value={item.time} disabled={item.isTimeUnset} onChange={(event) => updateItem(item.id, { time: event.target.value })} /></label>
                <label className="unset-field"><input type="checkbox" checked={item.isTimeUnset} onChange={(event) => updateItem(item.id, { isTimeUnset: event.target.checked })} />未定</label>
                <IconButton label={`${item.title || "予定"}を削除`} className="danger" onClick={() => deleteItem(item.id)}><Trash2 size={19} /></IconButton>
              </div>
              <label><span>予定</span><input value={item.title} maxLength={40} placeholder="例：ホテルにチェックイン" onChange={(event) => updateItem(item.id, { title: event.target.value })} /></label>
              <label><span>メモ</span><textarea value={item.memo} maxLength={120} rows={2} placeholder="待ち合わせや予約番号など" onChange={(event) => updateItem(item.id, { memo: event.target.value })} /></label>
              <label><span>地図URL</span><input type="url" value={item.mapUrl} placeholder="https://maps.google.com/..." onChange={(event) => updateItem(item.id, { mapUrl: event.target.value })} /></label>
              {safeExternalUrl(item.mapUrl) && <a className="inline-map-link" href={safeExternalUrl(item.mapUrl)} target="_blank" rel="noreferrer"><MapPin size={17} />地図を開く</a>}
            </Panel>
          )) : <EmptyState>この日の予定はまだありません。</EmptyState>}
          <button className="button button-primary add-wide" type="button" onClick={addItem}><Plus size={20} />予定を追加</button>
        </div>
      ) : (
        <Panel className="plan-timeline" aria-label="選択した日の予定">
          {items.length ? items.map((item, index) => (
            <article className="plan-timeline-row" key={item.id}>
              <div className="plan-time">
                <span>{item.isTimeUnset || !item.time ? "未定" : item.time}</span>
                <i aria-hidden="true" />
              </div>
              <div className="plan-event">
                <small>{String(index + 1).padStart(2, "0")}</small>
                <strong>{item.title || "予定名なし"}</strong>
                {item.memo && <p>{item.memo}</p>}
                {safeExternalUrl(item.mapUrl) && <a className="inline-map-link" href={safeExternalUrl(item.mapUrl)} target="_blank" rel="noreferrer"><MapPin size={17} />地図を開く</a>}
              </div>
            </article>
          )) : (
            <div className="plan-empty">
              <EmptyState>この日の予定はまだありません。</EmptyState>
              <button className="button button-secondary" type="button" onClick={() => setIsEditing(true)}><Plus size={18} />予定を追加</button>
            </div>
          )}
        </Panel>
      )}

      <section className="section-block route-block">
        <SectionHeading eyebrow="ROUTE & STAY" title="移動とホテル" description={tripSettings.mapNote} />
        <div className="route-layout">
          <div className="map-frame"><iframe title={`${tripSettings.mapOrigin}から${tripSettings.mapDestination}までの地図`} loading="lazy" referrerPolicy="no-referrer-when-downgrade" src={mapsEmbed(tripSettings.mapOrigin, tripSettings.mapDestination)} /></div>
          <Panel className="route-details">
            <div><span>START</span><strong>{tripSettings.mapOrigin}</strong></div>
            <i aria-hidden="true" />
            <div><span>STAY</span><strong>{tripSettings.hotelName}</strong><small>{tripSettings.hotelAddress}</small></div>
            <a className="button button-primary" href={mapsDirections(tripSettings.mapOrigin, tripSettings.mapDestination)} target="_blank" rel="noreferrer">Google Mapsで経路を見る<ExternalLink size={17} /></a>
            <a className="button button-secondary" href={mapsSearch(`${tripSettings.hotelName} ${tripSettings.hotelAddress}`)} target="_blank" rel="noreferrer">住所からホテルを検索<MapPin size={17} /></a>
          </Panel>
        </div>
      </section>
    </div>
  );
}
