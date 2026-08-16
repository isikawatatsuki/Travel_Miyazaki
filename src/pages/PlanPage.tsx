import { useMemo, useState } from "react";
import { Check, ExternalLink, MapPin, Plus, Settings2, Trash2 } from "lucide-react";
import { useTrip } from "../TripContext";
import { getScheduleDays } from "../data";
import { buildTicketRoute, isValidCoordinate, resolvePlace, scheduleItemCoordinate, stayForDay } from "../tickets";
import { makeId, mapsDirections, mapsEmbed, mapsSearch, safeExternalUrl } from "../lib";
import type { ScheduleItem } from "../types";
import { EmptyState, IconButton, PageHelp, Panel, SectionHeading } from "../components/ui";
import { LocationPicker } from "../components/LocationPicker";
import { MapLocationField } from "../components/MapLocationField";

type LocationTarget = { kind: "origin" | "destination" | "stay" } | { kind: "item"; id: string };

export function PlanPage() {
  const [isEditing, setIsEditing] = useState(false);
  const [locationTarget, setLocationTarget] = useState<LocationTarget | null>(null);
  const { tripSettings, setTripSettings, schedule, setSchedule, helpOpen, setHelpOpen } = useTrip();
  // 地図は予定から作った経路に合わせる。予定に場所が無ければ旅行設定へ落ちる。
  const route = useMemo(() => buildTicketRoute({ tripSettings, schedule } as Parameters<typeof buildTicketRoute>[0]), [schedule, tripSettings]);
  const first = route.points[0];
  const last = route.points[route.points.length - 1];
  // 横のリストと地図は必ず同じ値から作る。予定由来なら地点名と座標が同じ予定に
  // 属するので座標を使い、設定由来なら地名と緯度経度が別々に編集できてしまうため
  // 両方とも地名を使う。混ぜると「リストは弁天町、地図は鹿児島空港」になる。
  const fromSchedule = route.source === "schedule" && Boolean(first);
  const startLabel = fromSchedule ? first.title : tripSettings.mapOrigin;
  const endLabel = fromSchedule && last !== first ? last.title : tripSettings.mapDestination;
  const mapFrom = fromSchedule ? `${first.lat},${first.lng}` : startLabel;
  const mapTo = fromSchedule && last !== first ? `${last.lat},${last.lng}` : endLabel;
  const days = getScheduleDays(tripSettings);
  const activeDay = days.some((day) => day.id === schedule.activeDay) ? schedule.activeDay : days[0].id;
  const stay = stayForDay(schedule.items, activeDay);
  const stayPlace = stay ? resolvePlace(stay.mapUrl, stay.title) : null;
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
  const originSelected = isValidCoordinate(tripSettings.mapOriginLat, tripSettings.mapOriginLng);
  const destinationSelected = isValidCoordinate(tripSettings.mapDestinationLat, tripSettings.mapDestinationLng);

  return (
    <div className="page plan-page">
      <PageHelp open={helpOpen} onChange={setHelpOpen}>
        <p>日ごとにタブが分かれます。時刻未定でも登録でき、地図リンクから経路を開けます。</p>
        <p>「予定を設定」からアプリ内の地図を開き、ピンを置いて場所名を付けると、その場所が<b>旅の地図</b>の経路に並びます。</p>
      </PageHelp>
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
          <Panel className="trip-places">
            <h3>この旅の出発地と目的地</h3>
            <p className="place-note">ホームの背景地図と、旅の地図の基準になります。予定に場所を登録すると、そちらが優先されます。</p>
            <MapLocationField title="出発地" name={tripSettings.mapOrigin} selected={originSelected} mapUrl={tripSettings.mapOriginUrl} onOpen={() => setLocationTarget({ kind: "origin" })} />
            <MapLocationField title="目的地" name={tripSettings.mapDestination} selected={destinationSelected} mapUrl={tripSettings.mapDestinationUrl} onOpen={() => setLocationTarget({ kind: "destination" })} />
          </Panel>

          <Panel className="trip-places">
            <h3>{days.find((day) => day.id === activeDay)?.shortLabel}の宿</h3>
            <p className="place-note">
              {stay && stay.day !== activeDay
                ? `${stay.day.slice(5).replace("-", "/")}の宿を引き継いでいます。この日だけ変えるなら地図から選び直してください。`
                : "この日以降の宿として引き継がれます。"}
            </p>
            <MapLocationField title="宿" name={stay?.locationName || stay?.title || ""} selected={Boolean(stay && scheduleItemCoordinate(stay))} mapUrl={stay?.mapUrl} onOpen={() => setLocationTarget({ kind: "stay" })} />
          </Panel>

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
              <MapLocationField title="場所" name={item.locationName || ""} selected={Boolean(scheduleItemCoordinate(item))} mapUrl={item.mapUrl} onOpen={() => setLocationTarget({ kind: "item", id: item.id })} />

              <label className="unset-field">
                <input type="checkbox" checked={item.inRoute !== false} onChange={(event) => updateItem(item.id, { inRoute: event.target.checked })} />
                旅の経路に含める
              </label>
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
                {item.locationName && <p className="plan-location-name"><MapPin size={15} aria-hidden="true" />{item.locationName}</p>}
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
          <div className="map-frame"><iframe title={`${startLabel}から${endLabel}までの地図`} loading="lazy" referrerPolicy="no-referrer-when-downgrade" src={mapsEmbed(mapFrom, mapTo)} /></div>
          <Panel className="route-details">
            <div><span>START</span><strong>{startLabel}</strong></div>
            <i aria-hidden="true" />
            <div><span>GOAL</span><strong>{endLabel}</strong></div>
            <i aria-hidden="true" />
            <div><span>STAY</span><strong>{stayPlace?.name || stay?.title || tripSettings.hotelName || "未設定"}</strong>{stay && stay.day !== activeDay && <small>{stay.day.slice(5).replace("-", "/")}から引き継ぎ</small>}</div>
            <p className="route-source">{fromSchedule ? `この地図は予定に登録した${route.points.length}地点から描いています。` : "予定に場所がまだ無いため、設定の「地図の出発地・目的地」を表示しています。"}</p>
            <a className="button button-primary" href={mapsDirections(mapFrom, mapTo)} target="_blank" rel="noreferrer">Google Mapsで経路を見る<ExternalLink size={17} /></a>
            {(stayPlace?.url || tripSettings.hotelName) && (
              <a className="button button-secondary" href={stayPlace?.url || mapsSearch(`${tripSettings.hotelName} ${tripSettings.hotelAddress}`)} target="_blank" rel="noreferrer">宿を地図で見る<MapPin size={17} /></a>
            )}
          </Panel>
        </div>
      </section>

      {locationTarget && (() => {
        const locationItem = locationTarget.kind === "item" ? schedule.items.find((item) => item.id === locationTarget.id) : null;
        const current = locationTarget.kind === "origin"
          ? (originSelected ? { lat: tripSettings.mapOriginLat, lng: tripSettings.mapOriginLng } : null)
          : locationTarget.kind === "destination"
            ? (destinationSelected ? { lat: tripSettings.mapDestinationLat, lng: tripSettings.mapDestinationLng } : null)
            : locationTarget.kind === "stay"
              ? (stay ? scheduleItemCoordinate(stay) : null)
              : (locationItem ? scheduleItemCoordinate(locationItem) : null);
        const initialName = locationTarget.kind === "origin" ? tripSettings.mapOrigin
          : locationTarget.kind === "destination" ? tripSettings.mapDestination
            : locationTarget.kind === "stay" ? (stay?.locationName || stay?.title || "")
              : (locationItem?.locationName || "");
        return (
          <LocationPicker
            initial={current || undefined}
            initialName={initialName}
            onClose={() => setLocationTarget(null)}
            onConfirm={(location) => {
              const query = `${location.lat},${location.lng}`;
              const mapUrl = mapsSearch(query);
              if (locationTarget.kind === "origin") {
                setTripSettings((currentSettings) => ({ ...currentSettings, mapOrigin: location.name, mapOriginLat: location.lat, mapOriginLng: location.lng, mapOriginUrl: mapUrl }));
              } else if (locationTarget.kind === "destination") {
                setTripSettings((currentSettings) => ({ ...currentSettings, mapDestination: location.name, mapDestinationLat: location.lat, mapDestinationLng: location.lng, mapDestinationUrl: mapUrl }));
              } else if (locationTarget.kind === "stay") {
                setSchedule((currentSchedule) => {
                  const own = currentSchedule.items.find((entry) => entry.isStay && entry.day === activeDay);
                  const patch = { mapUrl, title: location.name || "宿", locationName: location.name, lat: location.lat, lng: location.lng };
                  if (own) return { ...currentSchedule, items: currentSchedule.items.map((entry) => entry.id === own.id ? { ...entry, ...patch } : entry) };
                  return { ...currentSchedule, items: [...currentSchedule.items, { id: makeId("stay"), day: activeDay, time: "", memo: "", isTimeUnset: true, isStay: true, inRoute: false, ...patch } as ScheduleItem] };
                });
              } else if (locationItem) {
                updateItem(locationItem.id, { lat: location.lat, lng: location.lng, locationName: location.name, mapUrl });
              }
              setLocationTarget(null);
            }}
          />
        );
      })()}
    </div>
  );
}
