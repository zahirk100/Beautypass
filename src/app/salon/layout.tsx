import Link from "next/link";
import { Logo } from "@/components/Logo";
import { NavLink } from "@/components/NavLink";
import { roleLabel } from "@/lib/format";
import { signOut } from "../actions";
import { getSalonContext } from "./context";
import { switchSalon } from "./actions";

export const metadata = { title: "Salonportaal" };

export default async function SalonLayout({ children }: { children: React.ReactNode }) {
  const { salons, current, profile } = await getSalonContext();
  return (
    <div className="shell">
      <aside className="sidebar">
        <Logo light sub="Salonportaal" href="/salon" />
        {salons.length > 1 && (
          <form action={switchSalon} className="switch">
            <select name="salon" defaultValue={current.salon_id} aria-label="Kies salon">
              {salons.map((s) => <option key={s.salon_id} value={s.salon_id}>{s.salons?.name}</option>)}
            </select>
            <button className="btn secondary small" style={{ marginTop: 6 }}>Wissel</button>
          </form>
        )}
        <nav>
          <NavLink href="/salon" exact>Vandaag</NavLink>
          <NavLink href="/salon/agenda">Agenda</NavLink>
          <NavLink href="/salon/uitbetalingen">Uitbetalingen</NavLink>
          <NavLink href="/salon/instellingen">Salon &amp; team</NavLink>
        </nav>
        <div className="who">
          <div><b>{current.salons?.name}</b><br />{profile?.first_name} · {roleLabel[current.role]}</div>
          <div className="inline-form">
            {profile?.admin_role && <Link href="/admin" className="small">Beheer</Link>}
            <form action={signOut}><button className="linkbtn small" style={{ color: "inherit" }}>Uitloggen</button></form>
          </div>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
