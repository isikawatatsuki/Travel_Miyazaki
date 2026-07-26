import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Crosshair, MapPin, X } from "lucide-react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { isValidCoordinate } from "../tickets";
import { IconButton } from "./ui";

type Coordinate = { lat: number; lng: number };

function roundedCoordinate(lat: number, lng: number): Coordinate {
  return { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) };
}

export function LocationPicker({
  initial,
  onConfirm,
  onClose,
}: {
  initial?: Coordinate;
  onConfirm: (coordinate: Coordinate) => void;
  onClose: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const [picked, setPicked] = useState<Coordinate | null>(
    initial && isValidCoordinate(initial.lat, initial.lng) ? initial : null,
  );
  const [locationStatus, setLocationStatus] = useState("");

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose]);

  useEffect(() => {
    if (!containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: "https://tiles.openfreemap.org/styles/positron",
      center: picked ? [picked.lng, picked.lat] : [137.5, 36.2],
      zoom: picked ? 15 : 4.2,
      attributionControl: false,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.on("click", (event) => setPicked(roundedCoordinate(event.lngLat.lat, event.lngLat.lng)));
    mapRef.current = map;
    const resize = window.setTimeout(() => map.resize(), 0);

    return () => {
      window.clearTimeout(resize);
      markerRef.current?.remove();
      markerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
    // 初期位置はモーダルを開いた時点の値として扱う。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !picked) return;
    if (!markerRef.current) {
      const marker = new maplibregl.Marker({ color: "#d85f4b", draggable: true })
        .setLngLat([picked.lng, picked.lat])
        .addTo(map);
      marker.on("dragend", () => {
        const point = marker.getLngLat();
        setPicked(roundedCoordinate(point.lat, point.lng));
      });
      markerRef.current = marker;
    } else {
      markerRef.current.setLngLat([picked.lng, picked.lat]);
    }
  }, [picked]);

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus("この端末では現在地を取得できません。");
      return;
    }
    setLocationStatus("現在地を取得しています…");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const coordinate = roundedCoordinate(coords.latitude, coords.longitude);
        setPicked(coordinate);
        setLocationStatus("");
        mapRef.current?.easeTo({ center: [coordinate.lng, coordinate.lat], zoom: 16, duration: 500 });
      },
      () => setLocationStatus("現在地を取得できませんでした。位置情報の許可を確認してください。"),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  };

  return createPortal(
    <div className="location-picker-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="location-picker-dialog" role="dialog" aria-modal="true" aria-labelledby="location-picker-title">
        <header className="location-picker-head">
          <div>
            <p className="eyebrow">LOCATION</p>
            <h2 id="location-picker-title">地図から場所を選ぶ</h2>
          </div>
          <IconButton label="場所の選択を閉じる" onClick={onClose}><X size={20} /></IconButton>
        </header>

        <p className="location-picker-guide">地図をタップするか、ピンをドラッグして場所を合わせてください。</p>
        <button className="button button-secondary location-current" type="button" onClick={useCurrentLocation}>
          <Crosshair size={18} aria-hidden="true" />現在地を使う
        </button>
        {locationStatus && <p className="location-picker-status" role="status">{locationStatus}</p>}

        <div className="location-picker-map" ref={containerRef} aria-label="場所を選択する地図" />
        <p className="location-picker-attribution">© OpenStreetMap contributors / OpenFreeMap</p>

        <div className="location-picker-coordinate" aria-live="polite">
          <MapPin size={18} aria-hidden="true" />
          {picked
            ? <span>緯度 {picked.lat} ・ 経度 {picked.lng}</span>
            : <span>地図上で場所を選んでください</span>}
        </div>
        <footer className="location-picker-actions">
          <button className="button button-quiet" type="button" onClick={onClose}>キャンセル</button>
          <button className="button button-primary" type="button" disabled={!picked} onClick={() => picked && onConfirm(picked)}>この場所を設定</button>
        </footer>
      </section>
    </div>,
    document.body,
  );
}
