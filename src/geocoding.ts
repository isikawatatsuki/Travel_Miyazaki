import type { MapLocation } from "./types";

export type GeocoderResult = MapLocation & { id: string; label: string; name?: string };

type NominatimResult = { place_id: number; display_name: string; name?: string; lat: string; lon: string };

let lastGeocoderRequest = 0;
const geocoderCache = new Map<string, GeocoderResult[]>();
const mapCoverage = [
  { west: 135.35, south: 34.58, east: 135.58, north: 34.75 },
  { west: 135.15, south: 34.38, east: 135.34, north: 34.50 },
  { west: 130.55, south: 31.60, east: 131.25, north: 31.90 },
];

function isInMapCoverage({ longitude, latitude }: MapLocation) {
  return mapCoverage.some(({ west, south, east, north }) => longitude >= west && longitude <= east && latitude >= south && latitude <= north);
}

export async function geocodePlaces(query: string): Promise<GeocoderResult[]> {
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
    name: result.name || result.display_name.split(",")[0],
    longitude: Number(result.lon),
    latitude: Number(result.lat),
  })).filter(isInMapCoverage);
  geocoderCache.set(cacheKey, results);
  return results;
}
