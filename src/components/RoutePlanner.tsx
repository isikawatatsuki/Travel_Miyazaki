import { Bike, CarFront, LocateFixed, PersonStanding, Route } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { calculateRoadRoute, formatRouteDistance, formatRouteDuration, type RoadRoute, type RouteLeg, type RouteMode, type RoutePoint } from "../routing";
import { Panel } from "./ui";

type Props = { points: RoutePoint[]; onRouteChange: (route?: RoadRoute) => void; onFocusLeg: (leg: RouteLeg) => void };

const modes: { id: RouteMode; label: string; icon: typeof CarFront }[] = [
  { id: "auto", label: "車", icon: CarFront },
  { id: "pedestrian", label: "徒歩", icon: PersonStanding },
  { id: "bicycle", label: "自転車", icon: Bike },
];

export function RoutePlanner({ points, onRouteChange, onFocusLeg }: Props) {
  const [mode, setMode] = useState<RouteMode>("auto");
  const [route, setRoute] = useState<RoadRoute>();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const requestId = useRef(0);
  const pointsKey = points.map(({ id, longitude, latitude }) => `${id}:${longitude}:${latitude}`).join("|");

  useEffect(() => {
    requestId.current += 1;
    setRoute(undefined);
    setStatus("");
    onRouteChange(undefined);
  }, [pointsKey]);

  const calculate = async (nextMode: RouteMode) => {
    if (points.length < 2) {
      setStatus("この日に場所が設定された予定を2件以上用意してください。");
      return;
    }
    const currentRequest = ++requestId.current;
    setMode(nextMode);
    setLoading(true);
    setStatus(`${modes.find((item) => item.id === nextMode)?.label}ルートを計算中...`);
    try {
      const nextRoute = await calculateRoadRoute(points, nextMode);
      if (currentRequest !== requestId.current) return;
      setRoute(nextRoute);
      onRouteChange(nextRoute);
      setStatus(`${points.length}地点を通るルートを表示しています。`);
    } catch (error) {
      if (currentRequest !== requestId.current) return;
      setRoute(undefined);
      onRouteChange(undefined);
      setStatus(error instanceof Error && error.message.includes("No path")
        ? `${modes.find((item) => item.id === nextMode)?.label}で通行できない区間が含まれているため、全区間のルートを作成できませんでした。`
        : "道路ルートを計算できませんでした。通信状態や地点の位置を確認して、もう一度お試しください。");
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  };

  const selectMode = (nextMode: RouteMode) => {
    setMode(nextMode);
    if (route) void calculate(nextMode);
  };

  return (
    <Panel className="route-planner">
      <div className="route-planner-head">
        <div><span>ROAD ROUTE</span><h3><Route size={20} />予定順の道路ルート</h3></div>
        <small>{points.length}地点</small>
      </div>
      <div className="route-mode-switch" role="group" aria-label="移動手段">
        {modes.map(({ id, label, icon: Icon }) => <button type="button" key={id} aria-pressed={mode === id} className={mode === id ? "is-active" : ""} disabled={loading} onClick={() => selectMode(id)}><Icon size={18} />{label}</button>)}
      </div>
      <button className="button button-primary route-calculate" type="button" disabled={loading || points.length < 2} onClick={() => void calculate(mode)}>{loading ? "ルートを計算中..." : "ルートを計算"}</button>
      <p className="route-planner-status" aria-live="polite">{status || "場所が設定された予定を時間順に通るルートを計算します。"}</p>
      {route && <>
        <div className="route-summary" aria-label="ルート合計">
          <div><span>合計距離</span><strong>{formatRouteDistance(route.distanceKm)}</strong></div>
          <div><span>予想所要時間</span><strong>{formatRouteDuration(route.durationSeconds)}</strong></div>
        </div>
        <div className="route-legs" aria-label="ルート区間">
          {route.legs.map((leg, index) => <button type="button" key={leg.id} onClick={() => onFocusLeg(leg)}>
            <span className="route-leg-number">{index + 1}</span>
            <span className="route-leg-detail"><strong>{leg.from.label} → {leg.to.label}</strong><small>{formatRouteDistance(leg.distanceKm)}・{formatRouteDuration(leg.durationSeconds)}</small></span>
            <span className="route-leg-action"><LocateFixed size={17} />地図で見る</span>
          </button>)}
        </div>
      </>}
      <small className="route-service-note">計算時に予定地点の座標を外部経路サービスへ送信します。経路データ © OpenStreetMap contributors / Valhalla</small>
    </Panel>
  );
}
