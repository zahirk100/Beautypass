import Link from "next/link";
import { Logo } from "@/components/Logo";
import { NavLink } from "@/components/NavLink";
import { MobileTabs } from "@/components/MobileNav";
import { roleLabel } from "@/lib/format";
import { signOut } from "../actions";
import { getSalonContext } from "./context";
import { switchSalon } from "./actions";

export const metadata = { title: "Salonportaal" };

const links = [
  { href: "/salon", label: "Vandaag", icon: "⌂\uFE0E", exact: true },
  { href: "/salon/agenda", label: "Agenda", icon: "◷\uFE0E" },
  { href: "/salon/profiel", label: "Profiel", icon: "✿\uFE0E" },
  { href: "/salon/uitbetalingen", label: "Geld", icon: "€\uFE0E" },
  { href: "/salon/instellingen", label: "Team", icon: "☺\uFE0E" },
];

export default async function SalonLayout({ children }: { children: React.ReactNode }) {
  const { salons, current, profile } = await getSalonContext();
  const switcher = salons.length > 1 && (
    <form action={switchSalon} className="switch inline-form">
      <select name="salon" defaultValue={current.salon_id} aria-label="Kies salon">
        {salons.map((s) => <option key={s.salon_id} value={s.salon_id}>{s.salons?.name}</option>)}
      </select>
      <button className="btn secondary small">Wissel</button>
    </form>
  );
  return (
    <div className="shell">
      <aside className="sidebar">
        <Logo light sub="Salonportaal" href="/salon" />
        {switcher}
        <nav>{links.map((l) => <NavLink key={l.href} href={l.href} exact={l.exact}>{l.label === "Geld" ? "Uitbetalingen" : l.label === "Team" ? "Team & behandelingen" : l.label}</NavLink>)}</nav>
        <div className="who">
          <div><b>{current.salons?.name}</b><br />{profile?.first_name} · {roleLabel[current.role]}</div>
          <div className="inline-form">
            {profile?.admin_role && <Link href="/admin" className="small">Beheer</Link>}
            <form action={signOut}><button className="linkbtn small" style={{ color: "inherit" }}>Uitloggen</button></form>
          </div>
        </div>
      </aside>
      <header className="m-header">
        <Logo light href="/salon" />
        {switcher || <div className="ctx"><b>{current.salons?.name}</b>{roleLabel[current.role]} · <form action={signOut} style={{ display: "inline" }}><button className="linkbtn" style={{ color: "inherit", fontSize: "inherit" }}>uitloggen</button></form></div>}
      </header>
      <main className="main">{children}</main>
      <MobileTabs items={links} />
    </div>
  );
}
