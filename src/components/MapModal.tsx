import { MapPin, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { MapLocation } from "../types";
import { PmtilesMap, type MapMarker } from "./PmtilesMap";

type Props = {
  title: string;
  description: string;
  markers: MapMarker[];
  route?: MapLocation[];
  focusedRoute?: MapLocation[];
  focus?: MapMarker;
  onClose: () => void;
};

const focusableSelector = "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";

export function MapModal({ title, description, markers, route, focusedRoute, focus, onClose }: Props) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(focusableSelector));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [onClose]);

  return createPortal(
    <div className="map-modal-layer" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section ref={dialogRef} className="map-modal" role="dialog" aria-modal="true" aria-labelledby="map-modal-title" aria-describedby="map-modal-description">
        <header className="map-modal-header">
          <span className="map-modal-icon" aria-hidden="true"><MapPin size={22} /></span>
          <div>
            <p className="eyebrow">MAP</p>
            <h2 id="map-modal-title">{title}</h2>
            <p id="map-modal-description">{description}</p>
          </div>
          <button ref={closeRef} className="icon-button map-modal-close" type="button" aria-label="地図を閉じる" title="地図を閉じる" onClick={onClose}><X size={22} /></button>
        </header>
        <div className="map-modal-body">
          <PmtilesMap containerId="modal-route-map" showSearch={false} ariaLabel={`${title}の地図`} markers={markers} route={route} focusedRoute={focusedRoute} focus={focus} />
          <button className="button button-secondary map-modal-dismiss" type="button" onClick={onClose}>閉じる</button>
        </div>
      </section>
    </div>,
    document.body,
  );
}
