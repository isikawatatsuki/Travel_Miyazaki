import { useEffect, useState } from "react";
import { MapPinned, Navigation, PartyPopper, Ticket, X } from "lucide-react";
import { createPortal } from "react-dom";
import { IconButton } from "./ui";

const RELEASE_VERSION = "v0.1.0";
const STORAGE_KEY = "tabilog-release-notice";

function hasSeenCurrentRelease() {
  try {
    return localStorage.getItem(STORAGE_KEY) === RELEASE_VERSION;
  } catch {
    return false;
  }
}

export function ReleaseNotice() {
  const [open, setOpen] = useState(() => !hasSeenCurrentRelease());

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, RELEASE_VERSION);
    } catch {
      // 保存が使えない環境でも、この表示中は閉じられるようにする。
    }
    setOpen(false);
  };

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") dismiss(); };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="release-notice-backdrop" role="presentation">
      <section className="release-notice" role="dialog" aria-modal="true" aria-labelledby="release-notice-title">
        <header className="release-notice-head">
          <span className="release-notice-icon" aria-hidden="true"><PartyPopper size={28} /></span>
          <div>
            <p className="eyebrow">WHAT'S NEW ・ {RELEASE_VERSION}</p>
            <h2 id="release-notice-title">Tabilogをリリースしました</h2>
          </div>
          <IconButton label="アップデートのお知らせを閉じる" onClick={dismiss}><X size={20} /></IconButton>
        </header>

        <p className="release-notice-lead">旅の計画から思い出まで、ひとつのチケットにまとめられるようになりました。</p>
        <ul className="release-notice-list">
          <li><Ticket size={21} aria-hidden="true" /><span><strong>旅をチケットで管理</strong><small>計画中・旅行中・完了した旅を見やすく整理できます。</small></span></li>
          <li><MapPinned size={21} aria-hidden="true" /><span><strong>旅の地図を追加</strong><small>チケットごとの経路や、これまでの旅を地図で振り返れます。</small></span></li>
          <li><Navigation size={21} aria-hidden="true" /><span><strong>地図から予定場所を選択</strong><small>地図のタップ、ピンの移動、現在地から場所を登録できます。</small></span></li>
        </ul>

        <button className="button button-primary release-notice-confirm" type="button" autoFocus onClick={dismiss}>新しいTabilogを使う</button>
      </section>
    </div>,
    document.body,
  );
}
