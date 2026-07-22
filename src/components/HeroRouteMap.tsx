import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { TripSettings } from "../types";

type Coordinates = [number, number];

function curveBetween(origin: Coordinates, destination: Coordinates): Coordinates[] {
  const [startLng, startLat] = origin;
  const [endLng, endLat] = destination;
  const dx = endLng - startLng;
  const dy = endLat - startLat;
  const control: Coordinates = [
    (startLng + endLng) / 2 - dy * 0.34,
    (startLat + endLat) / 2 + dx * 0.2,
  ];

  return Array.from({ length: 33 }, (_, index) => {
    const t = index / 32;
    const inverse = 1 - t;
    return [
      inverse * inverse * startLng + 2 * inverse * t * control[0] + t * t * endLng,
      inverse * inverse * startLat + 2 * inverse * t * control[1] + t * t * endLat,
    ];
  });
}

export function HeroRouteMap({ settings }: { settings: TripSettings }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    const origin: Coordinates = [settings.mapOriginLng, settings.mapOriginLat];
    const destination: Coordinates = [settings.mapDestinationLng, settings.mapDestinationLat];
    if (![...origin, ...destination].every(Number.isFinite)) return;

    let disposed = false;
    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        style: "https://tiles.openfreemap.org/styles/positron",
        center: [(origin[0] + destination[0]) / 2, (origin[1] + destination[1]) / 2],
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
      const route = curveBetween(origin, destination);
      map.addSource("hero-route", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: route } }],
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
          features: [
            { type: "Feature", properties: { kind: "start" }, geometry: { type: "Point", coordinates: origin } },
            { type: "Feature", properties: { kind: "end" }, geometry: { type: "Point", coordinates: destination } },
          ],
        },
      });
      map.addLayer({
        id: "hero-route-points",
        type: "circle",
        source: "hero-route-points",
        paint: {
          "circle-radius": 7,
          "circle-color": ["match", ["get", "kind"], "end", "#d97687", "#23745b"],
          "circle-stroke-color": "#fffef9",
          "circle-stroke-width": 3,
        },
      });
      map.fitBounds(new maplibregl.LngLatBounds(origin, origin).extend(destination), {
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
  }, [settings.mapDestinationLat, settings.mapDestinationLng, settings.mapOriginLat, settings.mapOriginLng]);

  return (
    <>
      <div className={`hero-map ${loaded ? "is-loaded" : ""}`} ref={containerRef} aria-hidden="true" />
      <a className="hero-map-attribution" href="https://openfreemap.org/" target="_blank" rel="noreferrer">© OpenFreeMap © OpenStreetMap</a>
    </>
  );
}
