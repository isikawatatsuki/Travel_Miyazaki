import { Helicopter, Plane } from "lucide-react";

/**
 * マントを着けて飛ぶ人のシルエット。特定の作品のキャラクターではなく、
 * 一般的な「空を飛ぶ人」の形として描いている。
 */
function CapedFlyer() {
  return (
    <svg viewBox="0 0 44 24" width="40" height="22" fill="currentColor" aria-hidden="true">
      {/* 肩から後方上へあおられるマント。これが「飛んでいる人」を一番読ませる。 */}
      <path d="M27 10C20 6 12 3 5 2c3 4 6 6 10 7-4 1-7 2-10 5 8 0 16-1 22-2z" opacity=".55" />
      {/* 後ろへ流れる脚 */}
      <path d="M10 13.6c-1.1.1-1.7.7-1.6 1.5.1.8.9 1.3 2 1.2l8-.9-.5-2.6z" />
      {/* 胴 */}
      <path d="M17 11.4c-1.5.1-2.5 1.2-2.3 2.4.2 1.2 1.5 2 3 1.8l10-1.2-.9-3.5z" />
      {/* 前へ伸ばした腕 */}
      <path d="M32 7.6c-1.1 0-1.9.8-1.8 1.7.1.9 1.1 1.5 2.2 1.4l9-.7c1.2-.1 2-.6 1.9-1.4-.1-.8-.9-1.3-2.1-1.2z" />
      {/* 頭 */}
      <circle cx="30" cy="8" r="3.2" />
    </svg>
  );
}

/**
 * 空と、たまに横切る飛行物。すべて装飾なので支援技術からは隠す。
 * 動きが本体なので、prefers-reduced-motion では飛行物ごと出さない（CSS側）。
 */
export function Sky() {
  return (
    <div className="sky" aria-hidden="true">
      {[1, 2, 3, 4, 5, 6, 7].map((n) => <span key={n} className={`cloud cloud-${n}`} />)}
      <span className="flyer flyer-plane"><Plane size={26} strokeWidth={1.6} /></span>
      <span className="flyer flyer-heli"><Helicopter size={24} strokeWidth={1.6} /></span>
      <span className="flyer flyer-hero"><CapedFlyer /></span>
    </div>
  );
}
