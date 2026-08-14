import { useEffect, useRef, useState } from "react";
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
  const [status, setStatus] = useState("地図を読み込み中...");

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

  return (
    <div className="map-frame" role="region" aria-label={ariaLabel}>
      <div ref={containerRef} className="pmtiles-map" />
      {status && <p className="map-status" role="status">{status}</p>}
    </div>
  );
}
