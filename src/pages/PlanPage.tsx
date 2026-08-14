import { LocateFixed, MapPin, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { PmtilesMap, type MapMarker } from "../components/PmtilesMap";
import { EmptyState, IconButton, Panel, SectionHeading } from "../components/ui";
import { defaultTripSettings, getScheduleDays } from "../data";
import { makeId } from "../lib";
import { useTrip } from "../TripContext";
import type { MapLocation, ScheduleItem } from "../types";

export function PlanPage() {
  const { tripSettings, schedule, setSchedule } = useTrip();
  const [focusMarker, setFocusMarker] = useState<MapMarker>();
  const originLocation = tripSettings.mapOriginLocation || defaultTripSettings.mapOriginLocation;
  const destinationLocation = tripSettings.mapDestinationLocation || defaultTripSettings.mapDestinationLocation;
  const days = getScheduleDays(tripSettings);
  const activeDay = days.some((day) => day.id === schedule.activeDay) ? schedule.activeDay : days[0].id;
  const items = useMemo(() => schedule.items
    .filter((item) => item.day === activeDay)
    .sort((a, b) => (a.isTimeUnset ? "99:99" : a.time).localeCompare(b.isTimeUnset ? "99:99" : b.time)), [activeDay, schedule.items]);

  const updateItem = (id: string, patch: Partial<ScheduleItem>) => {
    setSchedule((current) => ({ ...current, items: current.items.map((item) => item.id === id ? { ...item, ...patch } : item) }));
  };
  const addItem = () => {
    setSchedule((current) => ({ ...current, items: [...current.items, { id: makeId("schedule"), day: activeDay, time: "", title: "", memo: "", isTimeUnset: true }] }));
  };
  const deleteItem = (id: string) => setSchedule((current) => ({ ...current, items: current.items.filter((item) => item.id !== id) }));
  const updateLocation = (id: string, key: keyof MapLocation, value: string) => {
    const currentLocation = schedule.items.find((item) => item.id === id)?.location;
    const next = Number(value);
    updateItem(id, { location: { longitude: 0, latitude: 0, ...currentLocation, [key]: Number.isFinite(next) ? next : 0 } });
  };

  const routeMarkers = useMemo<MapMarker[]>(() => [
    { id: "route-origin", label: tripSettings.mapOrigin, kind: "origin", ...originLocation },
    { id: "route-destination", label: tripSettings.mapDestination, kind: "destination", ...destinationLocation },
  ], [destinationLocation, originLocation, tripSettings.mapDestination, tripSettings.mapOrigin]);
  const scheduleMarkers = useMemo<MapMarker[]>(() => items.flatMap((item) => item.location ? [{ id: item.id, label: item.title || "予定地点", kind: "schedule" as const, ...item.location }] : []), [items]);
  const mapMarkers = [...routeMarkers, ...scheduleMarkers];
  const mapKey = mapMarkers.map(({ id, longitude, latitude }) => `${id}:${longitude}:${latitude}`).join("|");

  return (
    <div className="page">
      <SectionHeading eyebrow="PLAN" title="旅の予定" description="日ごとの流れをここでまとめます。入力内容は自動保存されます。" />
      <div className="day-tabs" role="tablist" aria-label="旅行日">
        {days.map((day) => <button key={day.id} role="tab" aria-selected={activeDay === day.id} className={activeDay === day.id ? "is-active" : ""} onClick={() => setSchedule((current) => ({ ...current, activeDay: day.id }))}>{day.shortLabel}<small>{day.label.split("（")[1]?.replace("）", "")}</small></button>)}
      </div>

      <div className="schedule-editor">
        {items.length ? items.map((item, index) => (
          <Panel className="schedule-card" key={item.id}>
            <div className="schedule-card-head">
              <span className="step-number">{String(index + 1).padStart(2, "0")}</span>
              <label className="time-field"><span>時間</span><input type="time" value={item.time} onInput={(event) => updateItem(item.id, { time: event.currentTarget.value, isTimeUnset: false })} /></label>
              <label className="unset-field"><input type="checkbox" checked={item.isTimeUnset} onChange={(event) => updateItem(item.id, { isTimeUnset: event.target.checked })} />未定</label>
              <IconButton label={`${item.title || "予定"}を削除`} className="danger" onClick={() => deleteItem(item.id)}><Trash2 size={19} /></IconButton>
            </div>
            <label><span>予定</span><input value={item.title} maxLength={40} placeholder="例：ホテルにチェックイン" onChange={(event) => updateItem(item.id, { title: event.target.value })} /></label>
            <label><span>メモ</span><textarea value={item.memo} maxLength={120} rows={2} placeholder="待ち合わせや予約番号など" onChange={(event) => updateItem(item.id, { memo: event.target.value })} /></label>
            <div className="location-fields">
              <label><span>経度</span><input type="number" inputMode="decimal" step="0.0001" value={item.location?.longitude ?? ""} placeholder="131.0736" onChange={(event) => updateLocation(item.id, "longitude", event.target.value)} /></label>
              <label><span>緯度</span><input type="number" inputMode="decimal" step="0.0001" value={item.location?.latitude ?? ""} placeholder="31.7356" onChange={(event) => updateLocation(item.id, "latitude", event.target.value)} /></label>
              <button className="button button-secondary location-button" type="button" disabled={!item.location} onClick={() => item.location && setFocusMarker({ id: item.id, label: item.title || "予定地点", kind: "schedule", ...item.location })}><LocateFixed size={17} />地図で見る</button>
            </div>
          </Panel>
        )) : <EmptyState>この日の予定はまだありません。</EmptyState>}
        <button className="button button-primary add-wide" type="button" onClick={addItem}><Plus size={20} />予定を追加</button>
      </div>

      <section className="section-block route-block">
        <SectionHeading eyebrow="ROUTE & STAY" title="移動とホテル" description={tripSettings.mapNote} />
        <div className="route-layout">
          <PmtilesMap key={mapKey} ariaLabel={`${tripSettings.mapOrigin}から${tripSettings.mapDestination}までのPMTiles地図`} markers={mapMarkers} route={[originLocation, destinationLocation]} focus={focusMarker} />
          <Panel className="route-details">
            <div><span>START</span><strong>{tripSettings.mapOrigin}</strong></div>
            <i aria-hidden="true" />
            <div><span>STAY</span><strong>{tripSettings.hotelName}</strong><small>{tripSettings.hotelAddress}</small></div>
            <button className="button button-primary" type="button" onClick={() => setFocusMarker(routeMarkers[0])}>出発地を地図で見る<LocateFixed size={17} /></button>
            <button className="button button-secondary" type="button" onClick={() => setFocusMarker(routeMarkers[1])}>ホテルを地図で見る<MapPin size={17} /></button>
          </Panel>
        </div>
      </section>
    </div>
  );
}
