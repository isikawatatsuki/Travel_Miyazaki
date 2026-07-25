import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { RoutePoint } from "../tickets";

export type MapRoute = { id: string; name: string; color: string; points: RoutePoint[] };

/** 全体表示で使う統一色。複数の旅が重なっても色が乱れないようにする。 */
export const UNIFIED_ROUTE_COLOR = "#4a6b8a";

type Coordinates = [number, number];

/** 直線だと重なった経路が判別できないので、既存のヒーロー地図と同じ緩い曲線で結ぶ。 */
function curveBetween(origin: Coordinates, destination: Coordinates): Coordinates[] {
  const [startLng, startLat] = origin;
  const [endLng, endLat] = destination;
  const dx = endLng - startLng;
  const dy = endLat - startLat;
  const control: Coordinates = [(startLng + endLng) / 2 - dy * 0.16, (startLat + endLat) / 2 + dx * 0.1];
  return Array.from({ length: 25 }, (_, index) => {
    const t = index / 24;
    const inverse = 1 - t;
    return [
      inverse * inverse * startLng + 2 * inverse * t * control[0] + t * t * endLng,
      inverse * inverse * startLat + 2 * inverse * t * control[1] + t * t * endLat,
    ] as Coordinates;
  });
}

function routeLine(points: RoutePoint[]): Coordinates[] {
  const coordinates: Coordinates[] = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const from: Coordinates = [points[index].lng, points[index].lat];
    const to: Coordinates = [points[index + 1].lng, points[index + 1].lat];
    coordinates.push(...curveBetween(from, to));
  }
  return coordinates;
}

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
