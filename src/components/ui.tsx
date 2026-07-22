import type { ButtonHTMLAttributes, HTMLAttributes, PropsWithChildren, ReactNode } from "react";
import { ChevronRight } from "lucide-react";

export function SectionHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="section-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        {description && <p className="section-description">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Panel({ children, className = "", ...props }: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) {
  return <div className={`panel ${className}`} {...props}>{children}</div>;
}

export function IconButton({ label, children, className = "", ...props }: PropsWithChildren<{ label: string; className?: string } & ButtonHTMLAttributes<HTMLButtonElement>>) {
  return <button className={`icon-button ${className}`} type="button" aria-label={label} title={label} {...props}>{children}</button>;
}

export function PageLink({ href, children }: PropsWithChildren<{ href: string }>) {
  return <a className="text-link" href={href}>{children}<ChevronRight size={18} aria-hidden="true" /></a>;
}

export function EmptyState({ children }: PropsWithChildren) {
  return <p className="empty-state">{children}</p>;
}
