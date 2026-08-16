import { useEffect, useState } from "react";
import { MapPinned, Navigation, PartyPopper, Ticket, X } from "lucide-react";
import { createPortal } from "react-dom";
import { IconButton } from "./ui";

const RELEASE_VERSION = "v0.1.1";
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
            <h2 id="release-notice-title">場所選択が使いやすくなりました</h2>
          </div>
          <IconButton label="アップデートのお知らせを閉じる" onClick={dismiss}><X size={20} /></IconButton>
        </header>

        <p className="release-notice-lead">予定の場所を、Tabilogの地図から直感的に登録できるようになりました。</p>
        <ul className="release-notice-list">
          <li><MapPinned size={21} aria-hidden="true" /><span><strong>アプリ内の地図で選択</strong><small>Google MapsのURLを貼らず、地図のタップやピン移動で場所を設定できます。</small></span></li>
          <li><Ticket size={21} aria-hidden="true" /><span><strong>場所名を別に設定</strong><small>「観光」などの予定名とは別に、「青島神社」などの場所名を付けられます。</small></span></li>
          <li><Navigation size={21} aria-hidden="true" /><span><strong>旅の地図にも反映</strong><small>設定した場所名と位置が、予定一覧と旅の経路に表示されます。</small></span></li>
        </ul>

        <button className="button button-primary release-notice-confirm" type="button" autoFocus onClick={dismiss}>新しいTabilogを使う</button>
      </section>
    </div>,
    document.body,
  );
}
