import { useEffect, useRef, useState, type FormEvent } from "react";
import { layers, namedFlavor } from "@protomaps/basemaps";
import * as maplibregl from "maplibre-gl";
import { LngLatBounds, type GeoJSONSource, type Map as MapLibreMap, type StyleSpecification } from "maplibre-gl";
import { Protocol } from "pmtiles";
import { geocodePlaces, type GeocoderResult } from "../geocoding";
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
  focusedRoute?: MapLocation[];
  focus?: MapMarker;
  ariaLabel: string;
  containerId?: string;
  showSearch?: boolean;
};

const protocol = new Protocol();
let protocolUsers = 0;

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

function routeGeoJson(route: MapLocation[]) {
  return { type: "Feature" as const, properties: {}, geometry: { type: "LineString" as const, coordinates: route.map(({ longitude, latitude }) => [longitude, latitude]) } };
}

function createStyle(route: MapLocation[], focusedRoute: MapLocation[]): StyleSpecification {
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
        data: routeGeoJson(route),
      },
      "route-focus": {
        type: "geojson",
        data: routeGeoJson(focusedRoute),
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
          "line-color": "#236b86",
          "line-width": ["interpolate", ["linear"], ["zoom"], 5, 3, 12, 6],
        },
      },
      {
        id: "trip-route-focus",
        type: "line",
        source: "route-focus",
        minzoom: 5,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "#d97687",
          "line-width": ["interpolate", ["linear"], ["zoom"], 5, 5, 12, 9],
        },
      },
    ],
  } as StyleSpecification;
}

export function PmtilesMap({ markers, route = [], focusedRoute = [], focus, ariaLabel, containerId = "route-map", showSearch = true }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const searchMarkerRef = useRef<maplibregl.Marker | null>(null);
  const [status, setStatus] = useState("地図を読み込み中...");
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchStatus, setSearchStatus] = useState("");
  const [searchResults, setSearchResults] = useState<GeocoderResult[]>([]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    acquireProtocol();
    const map = new maplibregl.Map({
      container,
      style: createStyle(route, focusedRoute),
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
      const boundsPoints = route.length > 1 ? route : markers;
      if (boundsPoints.length > 1) {
        const bounds = boundsPoints.reduce(
          (current, point) => current.extend([point.longitude, point.latitude]),
          new LngLatBounds([boundsPoints[0].longitude, boundsPoints[0].latitude], [boundsPoints[0].longitude, boundsPoints[0].latitude]),
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
    const map = mapRef.current;
    if (!focus || !map) return;
    const applyFocus = () => {
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      map.easeTo({ center: [focus.longitude, focus.latitude], zoom: 14, duration: reducedMotion ? 0 : 500 });
    };
    if (map.isStyleLoaded()) applyFocus();
    else map.once("load", applyFocus);
    return () => { map.off("load", applyFocus); };
  }, [focus]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const applyRouteFocus = () => {
      (map.getSource("route-focus") as GeoJSONSource | undefined)?.setData(routeGeoJson(focusedRoute));
      if (focusedRoute.length < 2) return;
      const bounds = focusedRoute.reduce(
        (current, point) => current.extend([point.longitude, point.latitude]),
        new LngLatBounds([focusedRoute[0].longitude, focusedRoute[0].latitude], [focusedRoute[0].longitude, focusedRoute[0].latitude]),
      );
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      map.fitBounds(bounds, { padding: 72, maxZoom: 15, duration: reducedMotion ? 0 : 500 });
    };
    if (map.isStyleLoaded()) applyRouteFocus();
    else map.once("load", applyRouteFocus);
    return () => { map.off("load", applyRouteFocus); };
  }, [focusedRoute]);

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
      const results = await geocodePlaces(normalized);
      setSearchResults(results);
      setSearchStatus(results.length ? `${results.length}件見つかりました。` : "収録範囲内に見つかりませんでした。住所や施設名を変えてお試しください。");
    } catch {
      setSearchStatus("地点を検索できませんでした。通信状態を確認して、もう一度お試しください。");
    } finally {
      setSearching(false);
    }
  };

  const showSearchResult = (result: GeocoderResult) => {
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
    <div className="map-container" id={containerId}>
      {showSearch && <form className="map-search" role="search" onSubmit={submitSearch}>
        <label><span>地図を検索</span><input type="search" value={query} placeholder="例：都城駅、鹿児島空港" onChange={(event) => setQuery(event.target.value)} /></label>
        <button className="button button-primary" type="submit" disabled={searching}>{searching ? "検索中..." : "検索"}</button>
      </form>}
      {showSearch && <p className="map-search-status" aria-live="polite">{searchStatus}</p>}
      {showSearch && searchResults.length > 0 && <div className="map-search-results" aria-label="検索結果">{searchResults.map((result) => <button type="button" key={result.id} onClick={() => showSearchResult(result)}>{result.label}</button>)}</div>}
      <div className="map-frame" role="region" aria-label={ariaLabel}>
        <div ref={containerRef} className="pmtiles-map" />
        {status && <p className="map-status" role="status">{status}</p>}
      </div>
      {showSearch && <small className="geocoder-attribution">検索データ © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a></small>}
    </div>
  );
}
