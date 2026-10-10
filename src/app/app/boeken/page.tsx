import Link from "next/link";
import dynamic from "next/dynamic";
import { getContext } from "@/lib/auth";
import { bikeMinutes, formatDistance } from "@/lib/geo";
import { Flash } from "@/components/Flash";
import { LocateButton } from "@/components/LocateButton";
import { Submit } from "@/components/Submit";
import { loadMembership } from "../data";
import { loadSalons, myLocation, nextLabel } from "../salons";
import { saveLocation, toggleFavorite } from "../actions";

const SalonMap = dynamic(() => import("@/components/SalonMap"), { loading: () => <div className="map" style={{ height: 420 }} /> });

export const metadata = { title: "Boeken" };

const WHEN = [["", "Altijd"], ["today", "Vandaag"], ["tomorrow", "Morgen"], ["week", "Deze week"]];
const SORT = [["distance", "Dichtbij"], ["soon", "Eerst beschikbaar"], ["rating", "Best beoordeeld"]];

export default async function BrowseSalons({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const { supabase, user, profile } = await getContext();
  const me = myLocation(sp, profile);
  const [all, { balance }, { data: treatments }] = await Promise.all([
    loadSalons(supabase, user.id, me),
    loadMembership(supabase, user.id),
    supabase.from("treatments").select("id, slug, name").eq("active", true).order("sort"),
  ]);

  const filterT = (treatments ?? []).find((t: any) => t.slug === sp.t);
  const sort = SORT.some(([v]) => v === sp.sort) ? sp.sort : me ? "distance" : "rating";
  let list = all.filter((s) =>
    (!filterT || s.treatments.some((t) => t.id === filterT.id)) &&
    (sp.when !== "today" || s.slotsToday > 0) &&
    (sp.when !== "tomorrow" || s.slotsTomorrow > 0) &&
    (sp.when !== "week" || s.slotsWeek > 0) &&
    (sp.fav !== "1" || s.favorite));
  list = [...list].sort((a, b) => {
    if (sort === "distance" && a.distance != null && b.distance != null) return a.distance - b.distance;
    if (sort === "soon") return (a.nextSlot ?? "9999").localeCompare(b.nextSlot ?? "9999");
    return (b.rating ?? 0) - (a.rating ?? 0) || b.reviews - a.reviews;
  });

  // Build links that keep the other filters
  const keep = { t: sp.t, when: sp.when, sort: sp.sort, fav: sp.fav, lat: sp.lat, lng: sp.lng };
  const href = (patch: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    Object.entries({ ...keep, ...patch }).forEach(([k, v]) => v && q.set(k, v));
    const s = q.toString();
    return `/app/boeken${s ? `?${s}` : ""}`;
  };
  const current = href({});
  const usingBrowser = !!(sp.lat && sp.lng);

  return (
    <>
      <div className="page-head">
        <div><h1>Waar wil je <em>naartoe?</em></h1><p>{list.length} {list.length === 1 ? "salon" : "salons"} · je hebt <b>{balance} credits</b></p></div>
      </div>
      <Flash params={sp} />

      <div className="locbar">
        <span className="small"><b>Jouw locatie:</b> {usingBrowser ? "huidige locatie" : profile?.postcode ? profile.postcode.replace(/^(\d{4})/, "$1 ") : "nog niet ingesteld"}</span>
        <form action={saveLocation}>
          <input type="hidden" name="back" value={current} />
          <input name="postcode" placeholder="Postcode" defaultValue={profile?.postcode ?? ""} aria-label="Postcode" required />
          <Submit className="btn small">Opslaan</Submit>
        </form>
        <LocateButton />
      </div>

      <div className="filters">
        <div className="chips">
          <Link href={href({ t: undefined })} className={`chip${!filterT ? " on" : ""}`}>Alle behandelingen</Link>
          {(treatments ?? []).map((t: any) => <Link key={t.id} href={href({ t: t.slug })} className={`chip${filterT?.id === t.id ? " on" : ""}`}>{t.name}</Link>)}
        </div>
        <div className="chips">
          {WHEN.map(([v, l]) => <Link key={v} href={href({ when: v || undefined })} className={`chip${(sp.when ?? "") === v ? " on" : ""}`}>{l}</Link>)}
          <span className="muted small" style={{ alignSelf: "center", margin: "0 6px" }}>·</span>
          {SORT.map(([v, l]) => (
            <Link key={v} href={href({ sort: v })} className={`chip${sort === v ? " on" : ""}`} aria-disabled={v === "distance" && !me}>{l}</Link>
          ))}
          <span className="muted small" style={{ alignSelf: "center", margin: "0 6px" }}>·</span>
          <Link href={href({ fav: sp.fav === "1" ? undefined : "1" })} className={`chip${sp.fav === "1" ? " on" : ""}`}>♥ Favorieten</Link>
        </div>
        {sort === "distance" && !me && <p className="small muted">Vul je postcode in of gebruik je locatie om op afstand te sorteren.</p>}
      </div>

      <div className="browse">
        <div className="list">
          {list.length === 0 && <div className="card empty">Geen salons gevonden met deze filters. Probeer een andere dag of behandeling.</div>}
          {list.map((s) => {
            const shown = filterT ? s.treatments.filter((t) => t.id === filterT.id) : s.treatments;
            const cheapest = Math.min(...s.treatments.map((t) => t.credits));
            return (
              <div key={s.id} className="card salon-card">
                <div className="top">
                  <div className="grow">
                    <h2><Link href={`/app/boeken/${s.id}${filterT ? `?t=${filterT.slug}` : ""}`}>{s.name}</Link></h2>
                    <div className="meta">
                      <span>{s.district || "Amsterdam"}</span>
                      {s.distance != null && <span><b>{formatDistance(s.distance)}</b> · 🚲 {bikeMinutes(s.distance)} min</span>}
                      {s.rating != null ? <span><span className="stars">★</span> <b>{s.rating.toFixed(1).replace(".", ",")}</b> ({s.reviews})</span> : <span>Nieuw</span>}
                    </div>
                  </div>
                  <form action={toggleFavorite}>
                    <input type="hidden" name="salon" value={s.id} />
                    <input type="hidden" name="on" value={s.favorite ? "1" : "0"} />
                    <input type="hidden" name="back" value={current} />
                    <button className={`fav${s.favorite ? " on" : ""}`} aria-label={s.favorite ? "Verwijder uit favorieten" : "Bewaar als favoriet"} aria-pressed={s.favorite}>{s.favorite ? "♥" : "♡"}</button>
                  </form>
                </div>
                <div className="chips">
                  {shown.map((t) => <span key={t.id} className="chip">{t.name} · {t.credits}</span>)}
                </div>
                <div className="inline-form">
                  {s.nextSlot ? <span className="next-slot">Eerst vrij: {nextLabel(s.nextSlot)}</span> : <span className="badge neutral">Geen vrije tijden</span>}
                  {Number.isFinite(cheapest) && cheapest > balance && <span className="badge warn">Niet genoeg credits</span>}
                  <Link href={`/app/boeken/${s.id}${filterT ? `?t=${filterT.slug}` : ""}`} className="btn small right">Bekijk tijden</Link>
                </div>
              </div>
            );
          })}
        </div>
        <div className="map-col">
          <SalonMap
            salons={list.filter((s) => s.lat != null).map((s) => ({ id: s.id, name: s.name, lat: s.lat!, lng: s.lng! }))}
            me={me}
          />
        </div>
      </div>
    </>
  );
}
