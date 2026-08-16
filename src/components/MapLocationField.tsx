import { LocateFixed, MapPin } from "lucide-react";
import { safeExternalUrl } from "../lib";

export function MapLocationField({
  title,
  name,
  selected,
  mapUrl,
  onOpen,
}: {
  title: string;
  name: string;
  selected: boolean;
  mapUrl?: string;
  onOpen: () => void;
}) {
  const externalUrl = safeExternalUrl(mapUrl || "");

  return (
    <div className="map-location-field">
      <span>{title}</span>
      {selected ? (
        <div className="map-location-selected">
          <MapPin size={19} aria-hidden="true" />
          <div>
            <strong>{name.trim() || "名前未設定"}</strong>
            <small>地図上に場所を設定済み</small>
          </div>
        </div>
      ) : <p>まだ場所が選択されていません。</p>}
      <div className="map-location-actions">
        <button className="button button-secondary location-picker-open" type="button" onClick={onOpen}>
          <LocateFixed size={18} aria-hidden="true" />{selected ? "場所を変更" : "地図から場所を選ぶ"}
        </button>
        {externalUrl && <a className="inline-map-link" href={externalUrl} target="_blank" rel="noreferrer"><MapPin size={17} />地図を開く</a>}
      </div>
    </div>
  );
}
