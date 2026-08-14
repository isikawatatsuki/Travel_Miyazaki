import { Search } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { geocodePlaces, type GeocoderResult } from "../geocoding";
import type { MapLocation } from "../types";

type Props = {
  id: string;
  location?: MapLocation;
  locationLabel?: string;
  onSelect: (result: GeocoderResult) => void;
};

export function PlaceSearchField({ id, location, locationLabel = "", onSelect }: Props) {
  const [query, setQuery] = useState(locationLabel);
  const [searching, setSearching] = useState(false);
  const [status, setStatus] = useState("");
  const [results, setResults] = useState<GeocoderResult[]>([]);

  useEffect(() => setQuery(locationLabel), [locationLabel]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const normalized = query.trim();
    if (normalized.length < 2) {
      setResults([]);
      setStatus("施設名や住所を2文字以上入力してください。");
      return;
    }
    setSearching(true);
    setResults([]);
    setStatus("場所を検索中...");
    try {
      const nextResults = await geocodePlaces(normalized);
      setResults(nextResults);
      setStatus(nextResults.length ? `${nextResults.length}件見つかりました。候補を選んでください。` : "収録範囲内に見つかりませんでした。施設名や住所を変えてお試しください。");
    } catch {
      setStatus("場所を検索できませんでした。通信状態を確認して、もう一度お試しください。");
    } finally {
      setSearching(false);
    }
  };

  const select = (result: GeocoderResult) => {
    setQuery(result.name || result.label);
    setResults([]);
    setStatus("場所を設定しました。");
    onSelect(result);
  };

  return (
    <div className="place-search-field">
      <form className="place-search-controls" role="search" aria-label="予定の場所を検索" onSubmit={submit}>
        <label htmlFor={`place-${id}`}><span>場所</span><input id={`place-${id}`} type="search" value={query} placeholder="例：都城駅、鹿児島空港" onChange={(event) => setQuery(event.target.value)} /></label>
        <button className="button button-secondary" type="submit" disabled={searching}><Search size={17} />{searching ? "検索中" : "検索"}</button>
      </form>
      <p className="place-search-status" aria-live="polite">{status || (location ? `設定済み：${locationLabel || "予定地点"}` : "施設名や住所から地図上の場所を設定します。")}</p>
      {results.length > 0 && <div className="place-search-results" aria-label="場所の検索結果">{results.map((result) => <button type="button" key={result.id} onClick={() => select(result)}>{result.label}</button>)}</div>}
    </div>
  );
}
