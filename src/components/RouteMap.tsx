import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { routeLine } from "../tickets";
import type { RoutePoint } from "../tickets";

export type MapRoute = { id: string; name: string; color: string; points: RoutePoint[] };

/** 全体表示で使う統一色。複数の旅が重なっても色が乱れないようにする。 */
export const UNIFIED_ROUTE_COLOR = "#4a6b8a";

export function RouteMap({ routes, selectedId }: { routes: MapRoute[]; selectedId: string | null }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    try {
      mapRef.current = new maplibregl.Map({
        container: containerRef.current,
        style: "https://tiles.openfreemap.org/styles/positron",
        center: [138, 37],
        zoom: 4,
        attributionControl: false,
      });
      mapRef.current.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    } catch {
      mapRef.current = null;
    }
    return () => { mapRef.current?.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const draw = () => {
      const shown = selectedId ? routes.filter((route) => route.id === selectedId) : routes;

      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];

      const features = shown
        .filter((route) => route.points.length >= 2)
        .map((route) => ({
          type: "Feature" as const,
          properties: { color: selectedId ? route.color : UNIFIED_ROUTE_COLOR },
          geometry: { type: "LineString" as const, coordinates: routeLine(route.points) },
        }));

      const data = { type: "FeatureCollection" as const, features };
      const source = map.getSource("routes") as maplibregl.GeoJSONSource | undefined;
      if (source) {
        source.setData(data);
      } else {
        map.addSource("routes", { type: "geojson", data });
        map.addLayer({
          id: "routes-line",
          type: "line",
          source: "routes",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": ["get", "color"], "line-width": 3.5, "line-opacity": 0.9 },
        });
      }

      shown.forEach((route) => {
        route.points.forEach((point, index) => {
          const isEnd = index === 0 || index === route.points.length - 1;
          const element = document.createElement("span");
          element.className = `route-pin ${isEnd ? "is-end" : "is-stop"}`;
          element.style.setProperty("--pin", selectedId ? route.color : UNIFIED_ROUTE_COLOR);
          element.setAttribute("role", "img");
          element.setAttribute("aria-label", `${route.name} ${index + 1}番目 ${point.title}`);
          element.title = `${index + 1}. ${point.title}`;
          markersRef.current.push(new maplibregl.Marker({ element }).setLngLat([point.lng, point.lat]).addTo(map));
        });
      });

      const all = shown.flatMap((route) => route.points);
      if (all.length === 1) {
        map.easeTo({ center: [all[0].lng, all[0].lat], zoom: 10, duration: 500 });
      } else if (all.length > 1) {
        const bounds = all.reduce(
          (box, point) => box.extend([point.lng, point.lat] as maplibregl.LngLatLike),
          new maplibregl.LngLatBounds([all[0].lng, all[0].lat], [all[0].lng, all[0].lat]),
        );
        map.fitBounds(bounds, { padding: 56, maxZoom: 11, duration: 500 });
      }
    };

    if (map.isStyleLoaded()) draw();
    else map.once("load", draw);
  }, [routes, selectedId]);

  return <div className="route-map" ref={containerRef} />;
}
