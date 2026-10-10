/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { notFound } from "next/navigation";
import { getContext } from "@/lib/auth";
import { dateLong, dateShort, dayKey, time } from "@/lib/format";
import { bikeMinutes, distanceKm, formatDistance, routeUrl } from "@/lib/geo";
import { Flash } from "@/components/Flash";
import { Submit } from "@/components/Submit";
import { SlotPicker } from "@/components/SlotPicker";
import { instagramUrl, placeholderStyle, tiktokUrl } from "@/lib/social";
import { TREATMENT_PHOTO } from "@/lib/photos";
import { loadMembership } from "../../data";
import { myLocation } from "../../salons";
import { bookSlot, toggleFavorite } from "../../actions";

export default async function SalonBooking({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, user, profile } = await getContext();
  const { data: salon } = await supabase.from("salons").select("*").eq("id", id).eq("status", "active").maybeSingle();
  if (!salon) notFound();

  const [{ data: offers }, { data: slots }, { membership, balance }, { data: ratings }, { data: reviews }, { data: fav }] = await Promise.all([
    supabase.from("salon_treatments").select("credits_override, treatments(id, slug, name, credits, description, duration_min, sort)").eq("salon_id", id).eq("active", true),
    supabase.from("slots").select("id, starts_at").eq("salon_id", id).eq("status", "open").gt("starts_at", new Date().toISOString()).order("starts_at").limit(200),
    loadMembership(supabase, user.id),
    supabase.rpc("salon_ratings"),
    supabase.rpc("salon_recent_reviews", { p_salon: id, p_limit: 5 }),
    supabase.from("favorites").select("salon_id").eq("user_id", user.id).eq("salon_id", id).maybeSingle(),
  ]);
  const treatments = (offers ?? []).map((o: any) => ({ ...o.treatments, credits: o.credits_override ?? o.treatments?.credits }))
    .filter((t: any) => t.id).sort((a: any, b: any) => a.sort - b.sort);
  const coverUrl: string = salon.cover_url || TREATMENT_PHOTO[treatments[0]?.slug] || "";
  const preselect = treatments.find((t: any) => t.slug === sp.t && t.credits <= balance);

  // Day tabs: show one day at a time
  const days = new Map<string, any[]>();
  (slots ?? []).forEach((s: any) => { const k = dayKey(s.starts_at); days.set(k, [...(days.get(k) ?? []), s]); });
  const fmtDay = new Intl.DateTimeFormat("nl-NL", { timeZone: "Europe/Amsterdam", weekday: "short", day: "numeric", month: "short" });
  const pickerDays = [...days.entries()].slice(0, 14).map(([key, list]) => ({
    key, label: fmtDay.format(new Date(list[0].starts_at)), long: dateLong(list[0].starts_at),
    slots: list.map((x: any) => ({ id: x.id, time: time(x.starts_at) })),
  }));
  const canBook = membership?.status === "active";
  const rating = (ratings ?? []).find((r: any) => r.salon_id === id);
  const point = salon.latitude != null ? { lat: salon.latitude, lng: salon.longitude } : null;
  const me = myLocation(sp, profile);
  const km = me && point ? distanceKm(me, point) : null;

  return (
    <>
      <Link href="/app/boeken" className="small muted">← Alle salons</Link>
      <div className="cover" style={{ margin: "12px 0 18px", ...(coverUrl ? {} : placeholderStyle(salon.name)) }}>
        {coverUrl ? <img src={coverUrl} alt={`Sfeerfoto van ${salon.name}`} /> : <span className="initial">{salon.name.charAt(0)}</span>}
      </div>
      <div className="page-head">
        <div>
          <h1>{salon.name}</h1>
          {salon.tagline && <p style={{ marginTop: 4 }}>{salon.tagline}</p>}
          <div className="meta" style={{ marginTop: 8 }}>
            <span>{[salon.address, salon.district].filter(Boolean).join(" · ") || "Amsterdam"}</span>
            {km != null && <span><b>{formatDistance(km)}</b> · 🚲 {bikeMinutes(km)} min</span>}
            {rating ? <span><span className="stars">★</span> <b>{Number(rating.avg_rating).toFixed(1).replace(".", ",")}</b> ({rating.review_count} reviews)</span> : <span>Nieuw bij BeautyPass</span>}
          </div>
        </div>
        <div className="inline-form">
          {point && <a href={routeUrl(point)} target="_blank" rel="noopener noreferrer" className="btn secondary small">Route</a>}
          <form action={toggleFavorite}>
            <input type="hidden" name="salon" value={id} />
            <input type="hidden" name="on" value={fav ? "1" : "0"} />
            <input type="hidden" name="back" value={`/app/boeken/${id}`} />
            <button className={`fav${fav ? " on" : ""}`} aria-label={fav ? "Verwijder uit favorieten" : "Bewaar als favoriet"} aria-pressed={!!fav}>{fav ? "♥" : "♡"}</button>
          </form>
          <span className="badge">{balance} credits</span>
        </div>
      </div>
      {(salon.gallery ?? []).length > 0 && (
        <div className="gallery-strip" style={{ marginBottom: 18 }}>
          {(salon.gallery as string[]).map((url) => <img key={url} src={url} alt="" loading="lazy" />)}
        </div>
      )}
      {salon.description && <p className="muted" style={{ maxWidth: 680, marginBottom: 14 }}>{salon.description}</p>}
      {(salon.instagram || salon.tiktok || salon.website) && (
        <div className="socials" style={{ marginBottom: 22 }}>
          {salon.instagram && <a className="chip" href={instagramUrl(salon.instagram)} target="_blank" rel="noopener noreferrer">Instagram @{salon.instagram}</a>}
          {salon.tiktok && <a className="chip" href={tiktokUrl(salon.tiktok)} target="_blank" rel="noopener noreferrer">TikTok @{salon.tiktok}</a>}
          {salon.website && <a className="chip" href={salon.website} target="_blank" rel="noopener noreferrer">Website</a>}
        </div>
      )}
      <Flash params={sp} />

      {!canBook && (
        <div className="flash error">Je kunt boeken zodra je membership actief is. <Link href="/app/membership">Bekijk je membership</Link></div>
      )}

      <div className="grid two" style={{ alignItems: "start" }}>
        <form action={bookSlot} className="grid" style={{ gap: 18 }}>
          <input type="hidden" name="salon" value={salon.id} />
          <div className="card">
            <h2 style={{ marginBottom: 14 }}>1. Kies je behandeling</h2>
            <div className="list">
              {treatments.map((t: any) => (
                <label key={t.id} className="row-item" style={{ cursor: t.credits > balance ? "not-allowed" : "pointer", opacity: t.credits > balance ? .55 : 1 }}>
                  <input type="radio" name="treatment" value={t.id} required style={{ width: "auto" }} disabled={t.credits > balance} defaultChecked={preselect?.id === t.id} />
                  <div className="grow"><b>{t.name}</b><div className="small muted">{t.description} · ±{t.duration_min} min</div></div>
                  <span className={`badge${t.credits > balance ? " neutral" : ""}`}>{t.credits} credits</span>
                </label>
              ))}
              {treatments.length === 0 && <p className="muted">Deze salon heeft nog geen behandelingen online.</p>}
            </div>
          </div>

          <div className="card">
            <h2 style={{ marginBottom: 14 }}>2. Kies een tijd</h2>
            <SlotPicker days={pickerDays} />
          </div>

          <div className="card">
            <label className="field">Opmerking voor de salon <span className="hint">optioneel, bijv. een kleurwens</span>
              <textarea name="note" maxLength={300} rows={2} placeholder="Bijv. graag een nude kleur" />
            </label>
          </div>

          <div className="inline-form book-bar">
            {canBook ? (
              <>
                <Submit className="btn">Bevestig boeking</Submit>
                <span className="small muted">Gratis annuleren tot 24 uur vooraf.</span>
              </>
            ) : (
              <>
                <Link href="/app/membership" className="btn">Activeer eerst je membership</Link>
                <span className="small muted">Daarna kun je hier direct boeken.</span>
              </>
            )}
          </div>
        </form>

        <div className="card">
          <div className="card-head">
            <h2>Reviews</h2>
            {rating && <span className="badge"><span className="stars">★</span> {Number(rating.avg_rating).toFixed(1).replace(".", ",")}</span>}
          </div>
          {(reviews ?? []).length === 0 ? <p className="muted small">Nog geen reviews. Wees de eerste!</p> : (
            <div>
              {(reviews ?? []).map((r: any, i: number) => (
                <div key={i} className="review">
                  <div className="small"><span className="stars">{"★".repeat(r.rating)}</span> <b>{r.reviewer}</b> <span className="muted">· {dateShort(r.created_at)}</span></div>
                  {r.comment && <p className="small" style={{ marginTop: 4 }}>{r.comment}</p>}
                </div>
              ))}
            </div>
          )}
          <p className="small muted" style={{ marginTop: 12 }}>Alleen members die hier echt geweest zijn, kunnen een review geven.</p>
          {salon.opening_hours && (
            <div style={{ marginTop: 18 }}>
              <h3 style={{ marginBottom: 6 }}>Openingstijden</h3>
              <p className="hours">{salon.opening_hours}</p>
            </div>
          )}
          {salon.address && (
            <div style={{ marginTop: 18 }}>
              <h3 style={{ marginBottom: 6 }}>Adres</h3>
              <p className="hours">{salon.address}{salon.postcode ? `, ${salon.postcode.replace(/^(\d{4})/, "$1 ")}` : ""} Amsterdam</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
