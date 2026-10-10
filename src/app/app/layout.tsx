import Link from "next/link";
import { Logo } from "@/components/Logo";
import { NavLink } from "@/components/NavLink";
import { MobileTabs } from "@/components/MobileNav";
import { getContext } from "@/lib/auth";
import { signOut } from "../actions";

export const metadata = { title: "Mijn BeautyPass" };

const links = [
  { href: "/app", label: "Overzicht", icon: "✦", exact: true },
  { href: "/app/boeken", label: "Boeken", icon: "⌕" },
  { href: "/app/afspraken", label: "Afspraken", icon: "◷" },
  { href: "/app/membership", label: "Membership", icon: "◈" },
  { href: "/app/profiel", label: "Profiel", icon: "☺" },
];

export default async function MemberLayout({ children }: { children: React.ReactNode }) {
  const { profile, salons } = await getContext();
  return (
    <>
      <header className="topbar">
        <div className="in">
          <Logo href="/app" />
          <nav className="topnav">
            {links.map((l) => <NavLink key={l.href} href={l.href} exact={l.exact}>{l.label}</NavLink>)}
          </nav>
          <div className="inline-form">
            {profile?.admin_role && <Link href="/admin" className="btn secondary small top-extra">Beheer</Link>}
            {salons.length > 0 && <Link href="/salon" className="btn secondary small top-extra">Salon</Link>}
            <form action={signOut}><button className="linkbtn small muted">Uitloggen</button></form>
          </div>
        </div>
      </header>
      <main className="member-main">{children}</main>
      <MobileTabs items={links} />
    </>
  );
}
