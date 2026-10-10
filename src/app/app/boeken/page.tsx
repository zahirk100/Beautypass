import Link from "next/link";
import { getContext } from "@/lib/auth";

export const metadata = { title: "Boeken" };

export default async function BrowseSalons({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const { supabase } = await getContext();
  const [{ data: salons }, { data: treatments }, { data: offers }] = await Promise.all([
    supabase.from("salons").select("id, name, district, description").eq("status", "active").order("name"),
    supabase.from("treatments").select("id, slug, name").eq("active", true).order("sort"),
    supabase.from("salon_treatments").select("salon_id, treatment_id").eq("active", true),
  ]);
  const filter = (treatments ?? []).find((t: any) => t.slug === sp.t);
  const offered = (salonId: string) => (offers ?? []).filter((o: any) => o.salon_id === salonId).map((o: any) => o.treatment_id);
  const list = (salons ?? []).filter((s: any) => !filter || offered(s.id).includes(filter.id));

  return (
    <>
      <div className="page-head"><div><h1>Waar wil je <em>naartoe?</em></h1><p>Kies een salon en boek een tijd die jou uitkomt.</p></div></div>
      <div className="chips" style={{ marginBottom: 20 }}>
        <Link href="/app/boeken" className={`chip${!filter ? " on" : ""}`}>Alles</Link>
        {(treatments ?? []).map((t: any) => (
          <Link key={t.id} href={`/app/boeken?t=${t.slug}`} className={`chip${filter?.id === t.id ? " on" : ""}`}>{t.name}</Link>
        ))}
      </div>
      {list.length === 0 ? (
        <div className="card empty">Er zijn nog geen salons beschikbaar{filter ? " voor deze behandeling" : ""}. We breiden ons netwerk snel uit.</div>
      ) : (
        <div className="grid two">
          {list.map((s: any) => (
            <Link key={s.id} href={`/app/boeken/${s.id}`} className="card" style={{ textDecoration: "none", display: "grid", gap: 10 }}>
              <div className="card-head" style={{ marginBottom: 0 }}><h2>{s.name}</h2><span className="badge neutral">{s.district || "Amsterdam"}</span></div>
              {s.description && <p className="muted small">{s.description.slice(0, 160)}{s.description.length > 160 ? "…" : ""}</p>}
              <div className="chips">
                {(treatments ?? []).filter((t: any) => offered(s.id).includes(t.id)).map((t: any) => <span key={t.id} className="chip">{t.name}</span>)}
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
