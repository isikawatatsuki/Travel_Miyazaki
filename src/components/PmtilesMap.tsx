import { useEffect, useRef, useState, type FormEvent } from "react";
import { layers, namedFlavor } from "@protomaps/basemaps";
import * as maplibregl from "maplibre-gl";
import { LngLatBounds, type Map as MapLibreMap, type StyleSpecification } from "maplibre-gl";
import { Protocol } from "pmtiles";
import type { MapLocation } from "../types";
import "maplibre-gl/dist/maplibre-gl.css";

export type MapMarker = MapLocation & {
  id: string;
  label: string;
  kind?: "origin" | "destination" | "schedule";
};

type Props = {
  markers: MapMarker[];
  route?: MapLocation[];
  focus?: MapMarker;
  ariaLabel: string;
};

type SearchResult = MapLocation & { id: string; label: string };
type NominatimResult = { place_id: number; display_name: string; lat: string; lon: string };

const protocol = new Protocol();
let protocolUsers = 0;
let lastGeocoderRequest = 0;
const geocoderCache = new Map<string, SearchResult[]>();
const mapCoverage = [
  { west: 135.35, south: 34.58, east: 135.58, north: 34.75 },
  { west: 135.15, south: 34.38, east: 135.34, north: 34.50 },
  { west: 130.55, south: 31.60, east: 131.25, north: 31.90 },
];

function acquireProtocol() {
  if (protocolUsers === 0) maplibregl.addProtocol("pmtiles", protocol.tile);
  protocolUsers += 1;
}

function releaseProtocol() {
  protocolUsers -= 1;
  if (protocolUsers === 0) maplibregl.removeProtocol("pmtiles");
}

function pmtilesUrl() {
  const configured = import.meta.env.VITE_PMTILES_URL || "/maps/travel-miyazaki.pmtiles";
  return new URL(configured, window.location.origin).href;
}

function isInMapCoverage({ longitude, latitude }: MapLocation) {
  return mapCoverage.some(({ west, south, east, north }) => longitude >= west && longitude <= east && latitude >= south && latitude <= north);
}

async function geocode(query: string): Promise<SearchResult[]> {
  const cacheKey = query.trim().toLocaleLowerCase("ja-JP");
  const cached = geocoderCache.get(cacheKey);
  if (cached) return cached;
  const wait = Math.max(0, 1000 - (Date.now() - lastGeocoderRequest));
  if (wait) await new Promise((resolve) => window.setTimeout(resolve, wait));
  lastGeocoderRequest = Date.now();
  const endpoint = import.meta.env.VITE_GEOCODER_URL || "https://nominatim.openstreetmap.org/search";
  const url = new URL(endpoint);
  url.search = new URLSearchParams({
    q: query,
    format: "jsonv2",
    limit: "5",
    countrycodes: "jp",
    "accept-language": "ja",
  }).toString();
  const response = await fetch(url, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`Geocoder returned ${response.status}`);
  const payload = await response.json() as NominatimResult[];
  const results = payload.map((result) => ({
    id: `nominatim-${result.place_id}`,
    label: result.display_name,
    longitude: Number(result.lon),
    latitude: Number(result.lat),
  })).filter(isInMapCoverage);
  geocoderCache.set(cacheKey, results);
  return results;
}

function createStyle(route: MapLocation[]): StyleSpecification {
  return {
    version: 8,
    glyphs: "https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf",
    sprite: "https://protomaps.github.io/basemaps-assets/sprites/v4/light",
    sources: {
      protomaps: {
        type: "vector",
        url: `pmtiles://${pmtilesUrl()}`,
        attribution: '<a href="https://protomaps.com">Protomaps</a> © <a href="https://openstreetmap.org">OpenStreetMap</a>',
      },
      route: {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates: route.map(({ longitude, latitude }) => [longitude, latitude]) },
        },
      },
    },
    layers: [
      ...layers("protomaps", namedFlavor("light"), { lang: "ja" }),
      {
        id: "trip-route",
        type: "line",
        source: "route",
        minzoom: 5,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "#d97687",
          "line-width": ["interpolate", ["linear"], ["zoom"], 5, 2, 12, 5],
          "line-dasharray": [2, 1.5],
        },
      },
    ],
  } as StyleSpecification;
}

export function PmtilesMap({ markers, route = [], focus, ariaLabel }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const searchMarkerRef = useRef<maplibregl.Marker | null>(null);
  const [status, setStatus] = useState("地図を読み込み中...");
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchStatus, setSearchStatus] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    acquireProtocol();
    const map = new maplibregl.Map({
      container,
      style: createStyle(route),
      center: [131.0736, 31.7356],
      zoom: 10,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

    const mapMarkers = markers.map((marker, index) => {
      const element = document.createElement("button");
      element.type = "button";
      element.className = `map-marker map-marker-${marker.kind || "schedule"}`;
      element.textContent = marker.kind === "origin" ? "S" : marker.kind === "destination" ? "G" : String(index + 1);
      element.title = marker.label;
      element.setAttribute("aria-label", marker.label);
      element.addEventListener("click", () => map.easeTo({ center: [marker.longitude, marker.latitude], zoom: 14 }));
      return new maplibregl.Marker({ element, anchor: "bottom" })
        .setLngLat([marker.longitude, marker.latitude])
        .setPopup(new maplibregl.Popup({ offset: 18 }).setText(marker.label))
        .addTo(map);
    });

    map.once("load", () => {
      setStatus("");
      if (markers.length > 1) {
        const bounds = markers.reduce(
          (current, marker) => current.extend([marker.longitude, marker.latitude]),
          new LngLatBounds([markers[0].longitude, markers[0].latitude], [markers[0].longitude, markers[0].latitude]),
        );
        map.fitBounds(bounds, { padding: 58, maxZoom: 13, duration: 0 });
      } else if (markers[0]) {
        map.jumpTo({ center: [markers[0].longitude, markers[0].latitude], zoom: 13 });
      }
    });
    map.on("error", () => setStatus("地図データを読み込めませんでした。通信状態を確認してください。"));

    const observer = new ResizeObserver(() => map.resize());
    observer.observe(container);
    return () => {
      observer.disconnect();
      searchMarkerRef.current?.remove();
      mapMarkers.forEach((marker) => marker.remove());
      map.remove();
      mapRef.current = null;
      releaseProtocol();
    };
  }, []);

  useEffect(() => {
    if (!focus || !mapRef.current) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    mapRef.current.easeTo({ center: [focus.longitude, focus.latitude], zoom: 14, duration: reducedMotion ? 0 : 500 });
  }, [focus]);

  const submitSearch = async (event: FormEvent) => {
    event.preventDefault();
    const normalized = query.trim();
    if (normalized.length < 2) {
      setSearchResults([]);
      setSearchStatus("施設名や住所を2文字以上入力してください。");
      return;
    }
    const localResults = markers.filter((marker) => marker.label.toLocaleLowerCase("ja-JP").includes(normalized.toLocaleLowerCase("ja-JP")));
    if (localResults.length) {
      setSearchResults(localResults);
      setSearchStatus(`${localResults.length}件見つかりました。`);
      return;
    }
    setSearching(true);
    setSearchStatus("地点を検索中...");
    setSearchResults([]);
    try {
      const results = await geocode(normalized);
      setSearchResults(results);
      setSearchStatus(results.length ? `${results.length}件見つかりました。` : "収録範囲内に見つかりませんでした。住所や施設名を変えてお試しください。");
    } catch {
      setSearchStatus("地点を検索できませんでした。通信状態を確認して、もう一度お試しください。");
    } finally {
      setSearching(false);
    }
  };

  const showSearchResult = (result: SearchResult) => {
    const map = mapRef.current;
    if (!map) return;
    searchMarkerRef.current?.remove();
    const element = document.createElement("button");
    element.type = "button";
    element.className = "map-marker map-marker-search";
    element.textContent = "●";
    element.title = result.label;
    element.setAttribute("aria-label", result.label);
    searchMarkerRef.current = new maplibregl.Marker({ element, anchor: "bottom" })
      .setLngLat([result.longitude, result.latitude])
      .setPopup(new maplibregl.Popup({ offset: 24 }).setText(result.label))
      .addTo(map);
    searchMarkerRef.current.togglePopup();
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    map.easeTo({ center: [result.longitude, result.latitude], zoom: 14, duration: reducedMotion ? 0 : 500 });
    setSearchResults([]);
    setSearchStatus(`${result.label}を表示しています。`);
  };

  return (
    <div className="map-container">
      <form className="map-search" role="search" onSubmit={submitSearch}>
        <label><span>地図を検索</span><input type="search" value={query} placeholder="例：都城駅、鹿児島空港" onChange={(event) => setQuery(event.target.value)} /></label>
        <button className="button button-primary" type="submit" disabled={searching}>{searching ? "検索中..." : "検索"}</button>
      </form>
      <p className="map-search-status" aria-live="polite">{searchStatus}</p>
      {searchResults.length > 0 && <div className="map-search-results" aria-label="検索結果">{searchResults.map((result) => <button type="button" key={result.id} onClick={() => showSearchResult(result)}>{result.label}</button>)}</div>}
      <div className="map-frame" role="region" aria-label={ariaLabel}>
        <div ref={containerRef} className="pmtiles-map" />
        {status && <p className="map-status" role="status">{status}</p>}
      </div>
      <small className="geocoder-attribution">検索データ © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a></small>
    </div>
  );
}
