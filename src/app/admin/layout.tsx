import Link from "next/link";
import { Logo } from "@/components/Logo";
import { NavLink } from "@/components/NavLink";
import { roleLabel } from "@/lib/format";
import { signOut } from "../actions";
import { getAdminContext } from "./context";

export const metadata = { title: "Beheer" };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile, role, salons } = await getAdminContext();
  return (
    <div className="shell">
      <aside className="sidebar">
        <Logo light sub="Beheer" href="/admin" />
        <nav>
          <NavLink href="/admin" exact>Dashboard</NavLink>
          <NavLink href="/admin/wachtlijst">Wachtlijst</NavLink>
          <NavLink href="/admin/leden">Leden</NavLink>
          <NavLink href="/admin/salons">Salons</NavLink>
          <NavLink href="/admin/boekingen">Boekingen</NavLink>
          <NavLink href="/admin/behandelingen">Behandelingen</NavLink>
          <NavLink href="/admin/plannen">Memberships</NavLink>
          <NavLink href="/admin/team">Team</NavLink>
          <NavLink href="/admin/audit">Logboek</NavLink>
        </nav>
        <div className="who">
          <div><b>{profile?.first_name || "Team"}</b><br />{roleLabel[role]}</div>
          <div className="inline-form">
            <Link href="/app" className="small">Leden-app</Link>
            {salons.length > 0 && <Link href="/salon" className="small">Salon</Link>}
            <form action={signOut}><button className="linkbtn small" style={{ color: "inherit" }}>Uitloggen</button></form>
          </div>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
