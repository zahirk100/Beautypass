import Link from "next/link";
import { Logo } from "@/components/Logo";
import { NavLink } from "@/components/NavLink";
import { MobileTabs } from "@/components/MobileNav";
import { roleLabel } from "@/lib/format";
import { signOut } from "../actions";
import { getAdminContext } from "./context";

export const metadata = { title: "Beheer" };

const links = [
  { href: "/admin", label: "Dashboard", icon: "✦\uFE0E", exact: true },
  { href: "/admin/leden", label: "Leden", icon: "☺\uFE0E" },
  { href: "/admin/salons", label: "Salons", icon: "✿\uFE0E" },
  { href: "/admin/boekingen", label: "Boekingen", icon: "◷\uFE0E" },
  { href: "/admin/wachtlijst", label: "Wachtlijst", icon: "✉\uFE0E" },
  { href: "/admin/behandelingen", label: "Behandelingen", icon: "◇\uFE0E" },
  { href: "/admin/plannen", label: "Memberships", icon: "◈\uFE0E" },
  { href: "/admin/team", label: "Team", icon: "♛\uFE0E" },
  { href: "/admin/audit", label: "Logboek", icon: "≡\uFE0E" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile, role, salons } = await getAdminContext();
  return (
    <div className="shell">
      <aside className="sidebar">
        <Logo light sub="Beheer" href="/admin" />
        <nav>{links.map((l) => <NavLink key={l.href} href={l.href} exact={l.exact}>{l.label}</NavLink>)}</nav>
        <div className="who">
          <div><b>{profile?.first_name || "Team"}</b><br />{roleLabel[role]}</div>
          <div className="inline-form">
            <Link href="/app" className="small">Leden-app</Link>
            {salons.length > 0 && <Link href="/salon" className="small">Salon</Link>}
            <form action={signOut}><button className="linkbtn small" style={{ color: "inherit" }}>Uitloggen</button></form>
          </div>
        </div>
      </aside>
      <header className="m-header">
        <Logo light sub="Beheer" href="/admin" />
        <div className="ctx"><b>{profile?.first_name || "Team"}</b>{roleLabel[role]} · <form action={signOut} style={{ display: "inline" }}><button className="linkbtn" style={{ color: "inherit", fontSize: "inherit" }}>uitloggen</button></form></div>
      </header>
      <main className="main">{children}</main>
      <MobileTabs items={links} />
    </div>
  );
}
