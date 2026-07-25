import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { routeLine } from "../tickets";
import type { RoutePoint } from "../tickets";

/**
 * ホームの背景地図。予定から作った経路をそのまま描く。
 * 予定に座標が無いチケットでは buildTicketRoute が旅行設定の出発地・目的地へ
 * 落ちるので、ここでは points をそのまま信じてよい。
 */
export function HeroRouteMap({ points }: { points: RoutePoint[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!containerRef.current || points.length < 1) return;
    const line = routeLine(points);
    const first: [number, number] = [points[0].lng, points[0].lat];
    const last: [number, number] = [points[points.length - 1].lng, points[points.length - 1].lat];

    let disposed = false;
    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        style: "https://tiles.openfreemap.org/styles/positron",
        center: [(first[0] + last[0]) / 2, (first[1] + last[1]) / 2],
        zoom: 8,
        interactive: false,
        attributionControl: false,
        fadeDuration: 0,
      });
    } catch {
      return;
    }

    map.on("load", () => {
      if (disposed) return;
      map.addSource("hero-route", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: line } }],
        },
      });
      map.addLayer({
        id: "hero-route-shadow",
        type: "line",
        source: "hero-route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#fffef9", "line-opacity": 0.78, "line-width": 8 },
      });
      map.addLayer({
        id: "hero-route-line",
        type: "line",
        source: "hero-route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#14523f", "line-opacity": 0.9, "line-width": 4 },
      });
      map.addSource("hero-route-points", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: points.map((point, index) => ({
            type: "Feature",
            properties: { kind: index === 0 ? "start" : index === points.length - 1 ? "end" : "stop" },
            geometry: { type: "Point", coordinates: [point.lng, point.lat] },
          })),
        },
      });
      map.addLayer({
        id: "hero-route-points",
        type: "circle",
        source: "hero-route-points",
        paint: {
          "circle-radius": ["match", ["get", "kind"], "stop", 4.5, 7],
          "circle-color": ["match", ["get", "kind"], "end", "#d97687", "stop", "#4a97b5", "#23745b"],
          "circle-stroke-color": "#fffef9",
          "circle-stroke-width": 3,
        },
      });
      const bounds = points.reduce((box, point) => box.extend([point.lng, point.lat] as maplibregl.LngLatLike), new maplibregl.LngLatBounds(first, first));
      map.fitBounds(bounds, {
        padding: { top: 76, right: 88, bottom: 84, left: 88 },
        duration: 0,
        maxZoom: 10,
      });
      setLoaded(true);
    });

    return () => {
      disposed = true;
      map.remove();
    };
  }, [points]);

  return (
    <>
      <svg className="hero-map-fallback" viewBox="0 0 1000 460" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <path className="fallback-road fallback-road-wide" d="M-40 132 C150 110 240 192 410 160 S720 72 1040 106" />
        <path className="fallback-road" d="M42 438 C178 328 314 372 432 256 S682 146 972 212" />
        <path className="fallback-road" d="M138 -20 C184 124 250 214 338 470" />
        <path className="fallback-road" d="M684 -16 C654 118 710 266 842 480" />
        <path className="fallback-road fallback-road-minor" d="M-20 298 C210 226 372 314 552 354 S840 340 1020 278" />
        <path className="fallback-route-shadow" d="M108 366 C252 294 354 354 486 244 S704 232 878 102" />
        <path className="fallback-route" d="M108 366 C252 294 354 354 486 244 S704 232 878 102" />
        <circle className="fallback-point fallback-point-start" cx="108" cy="366" r="10" />
        <circle className="fallback-point fallback-point-end" cx="878" cy="102" r="10" />
      </svg>
      <div className={`hero-map ${loaded ? "is-loaded" : ""}`} ref={containerRef} aria-hidden="true" />
      {loaded && <a className="hero-map-attribution" href="https://openfreemap.org/" target="_blank" rel="noreferrer">© OpenFreeMap © OpenStreetMap</a>}
    </>
  );
}
