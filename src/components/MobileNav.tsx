"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export type NavItem = { href: string; label: string; icon: string; exact?: boolean };

const isActive = (path: string, item: NavItem) => (item.exact ? path === item.href : path === item.href || path.startsWith(item.href + "/"));

/** App-style bottom tab bar; items beyond the first four go into a "Meer" sheet. */
export function MobileTabs({ items }: { items: NavItem[] }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
  const main = items.length > 5 ? items.slice(0, 4) : items;
  const more = items.length > 5 ? items.slice(4) : [];
  const moreActive = more.some((i) => isActive(path, i));

  return (
    <>
      {open && <div className="m-scrim" onClick={() => setOpen(false)} />}
      {open && (
        <div className="m-sheet" role="dialog" aria-label="Meer">
          {more.map((i) => (
            <Link key={i.href} href={i.href} className={isActive(path, i) ? "active" : undefined}>
              <span aria-hidden="true">{i.icon}</span>{i.label}
            </Link>
          ))}
        </div>
      )}
      <nav className="m-tabs" aria-label="Hoofdmenu">
        {main.map((i) => (
          <Link key={i.href} href={i.href} className={isActive(path, i) ? "active" : undefined} aria-current={isActive(path, i) ? "page" : undefined}>
            <span className="ic" aria-hidden="true">{i.icon}</span>{i.label}
          </Link>
        ))}
        {more.length > 0 && (
          <button type="button" className={moreActive || open ? "active" : undefined} onClick={() => setOpen(!open)} aria-expanded={open}>
            <span className="ic" aria-hidden="true">☰</span>Meer
          </button>
        )}
      </nav>
    </>
  );
}
