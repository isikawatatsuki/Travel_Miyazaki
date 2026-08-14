import type { MapLocation } from "./types";

export type RouteMode = "auto" | "pedestrian" | "bicycle";
export type RoutePoint = MapLocation & { id: string; label: string };
export type RouteLeg = { id: string; from: RoutePoint; to: RoutePoint; distanceKm: number; durationSeconds: number; coordinates: MapLocation[] };
export type RoadRoute = { mode: RouteMode; distanceKm: number; durationSeconds: number; coordinates: MapLocation[]; legs: RouteLeg[] };

type ValhallaSummary = { length: number; time: number };
type ValhallaLeg = { summary: ValhallaSummary; shape: string };
type ValhallaResponse = { trip?: { summary: ValhallaSummary; legs: ValhallaLeg[] }; error?: string };

const routeCache = new Map<string, RoadRoute>();

function decodePolyline6(encoded: string): MapLocation[] {
  const coordinates: MapLocation[] = [];
  let index = 0;
  let latitude = 0;
  let longitude = 0;
  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    latitude += result & 1 ? ~(result >> 1) : result >> 1;
    result = 0;
    shift = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    longitude += result & 1 ? ~(result >> 1) : result >> 1;
    coordinates.push({ longitude: longitude / 1e6, latitude: latitude / 1e6 });
  }
  return coordinates;
}

export async function calculateRoadRoute(points: RoutePoint[], mode: RouteMode): Promise<RoadRoute> {
  if (points.length < 2) throw new Error("At least two route points are required");
  const cacheKey = `${mode}:${points.map(({ longitude, latitude }) => `${longitude},${latitude}`).join(";")}`;
  const cached = routeCache.get(cacheKey);
  if (cached) return cached;
  const endpoint = import.meta.env.VITE_ROUTER_URL || "https://valhalla1.openstreetmap.de/route";
  const url = new URL(endpoint);
  url.searchParams.set("json", JSON.stringify({
    locations: points.map(({ latitude, longitude }) => ({ lat: latitude, lon: longitude, type: "break" })),
    costing: mode,
    directions_options: { units: "kilometers", language: "ja-JP", narrative: false },
  }));
  const response = await fetch(url, { headers: { accept: "application/json" } });
  const payload = await response.json() as ValhallaResponse;
  if (!response.ok) throw new Error(payload.error || `Router returned ${response.status}`);
  if (!payload.trip || payload.trip.legs.length !== points.length - 1) throw new Error(payload.error || "Invalid route response");
  const legs = payload.trip.legs.map((leg, index): RouteLeg => ({
    id: `${points[index].id}-${points[index + 1].id}`,
    from: points[index],
    to: points[index + 1],
    distanceKm: leg.summary.length,
    durationSeconds: leg.summary.time,
    coordinates: decodePolyline6(leg.shape),
  }));
  const route: RoadRoute = {
    mode,
    distanceKm: payload.trip.summary.length,
    durationSeconds: payload.trip.summary.time,
    coordinates: legs.flatMap((leg, index) => index === 0 ? leg.coordinates : leg.coordinates.slice(1)),
    legs,
  };
  routeCache.set(cacheKey, route);
  return route;
}

export function formatRouteDistance(distanceKm: number) {
  return distanceKm < 1 ? `${Math.round(distanceKm * 1000)} m` : `${distanceKm.toFixed(distanceKm < 10 ? 1 : 0)} km`;
}

export function formatRouteDuration(durationSeconds: number) {
  const minutes = Math.max(1, Math.round(durationSeconds / 60));
  if (minutes < 60) return `約${minutes}分`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `約${hours}時間${rest ? `${rest}分` : ""}`;
}
