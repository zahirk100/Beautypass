/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { getContext } from "@/lib/auth";
import { dateShort, dayKey, time } from "@/lib/format";
import { bikeMinutes, formatDistance, routeUrl } from "@/lib/geo";
import { placeholderStyle } from "@/lib/social";
import { PHOTOS } from "@/lib/photos";
import { Flash } from "@/components/Flash";
import { StatusBadge } from "@/components/Badge";
import { loadMembership } from "./data";
import { loadSalons, myLocation, nextLabel } from "./salons";

function greeting() {
  const h = Number(new Intl.DateTimeFormat("nl-NL", { timeZone: "Europe/Amsterdam", hour: "numeric", hourCycle: "h23" }).format(new Date()));
  return h < 6 ? "Goedenacht" : h < 12 ? "Goedemorgen" : h < 18 ? "Goedemiddag" : "Goedenavond";
}

function relativeDay(iso: string) {
  const days = Math.round((new Date(dayKey(iso)).getTime() - new Date(dayKey(new Date().toISOString())).getTime()) / 864e5);
  if (days <= 0) return "Vandaag";
  if (days === 1) return "Morgen";
  return `Over ${days} dagen`;
}

export default async function MemberHome({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const { supabase, user, profile } = await getContext();
  const me = myLocation({}, profile);
  const [{ membership, balance }, { data: upcoming }, { data: last }, { data: treatments }, salons] = await Promise.all([
    loadMembership(supabase, user.id),
    supabase.from("bookings").select("id, starts_at, credits, salons(name, district, latitude, longitude, cover_url), treatments(name)")
      .eq("user_id", user.id).eq("status", "booked").gte("starts_at", new Date().toISOString()).order("starts_at").limit(3),
    supabase.from("bookings").select("salon_id, salons(name), treatments(name, slug)").eq("user_id", user.id).eq("status", "completed")
      .order("starts_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("treatments").select("slug, name, credits").eq("active", true).order("sort"),
    loadSalons(supabase, user.id, me),
  ]);
  const active = membership?.status === "active";
  const monthly = membership?.plans?.monthly_credits ?? 0;
  const pct = monthly ? Math.min(100, Math.round((balance / monthly) * 100)) : 0;
  const daysLeft = membership?.current_period_end ? Math.max(0, Math.ceil((new Date(membership.current_period_end).getTime() - Date.now()) / 864e5)) : null;
  const next: any = upcoming?.[0];
  const nearby = [...salons]
    .sort((a, b) => (a.distance != null && b.distance != null ? a.distance - b.distance : (b.rating ?? 0) - (a.rating ?? 0)))
    .slice(0, 8);
  const affordable = (treatments ?? []).filter((t: any) => t.credits <= balance);

  return (
    <>
      <Flash params={sp} />
      <p className="muted small" style={{ marginBottom: 4 }}>{greeting()},</p>
      <h1 style={{ marginBottom: 20 }}>{profile?.first_name || "daar"}</h1>

      <div className="home-grid">
        {/* The pass */}
        <Link href="/app/membership" className="pass-card" aria-label="Bekijk je membership">
          <div className="pc-top"><span>{active ? membership.plans?.name : "BeautyPass"}</span><span>{membership?.founding_number ? `Nº ${String(membership.founding_number).padStart(3, "0")}` : "Amsterdam"}</span></div>
          {active ? (
            <>
              <div><div className="pc-big">{balance}</div><div className="pc-sub">credits beschikbaar</div></div>
              <div>
                <div className="bar"><i style={{ width: `${pct}%` }} /></div>
                <div className="pc-foot"><span>{profile?.first_name} {profile?.last_name}</span><span>{daysLeft != null ? `+${monthly} over ${daysLeft} ${daysLeft === 1 ? "dag" : "dagen"}` : ""}</span></div>
              </div>
            </>
          ) : membership?.status === "pending" ? (
            <><div className="pc-mid">Je aanvraag is ontvangen</div><div className="pc-foot"><span>We starten je membership zo snel mogelijk</span></div></>
          ) : membership?.status === "paused" ? (
            <><div className="pc-mid">Membership gepauzeerd</div><div className="pc-foot"><span>Neem contact op om weer te starten</span></div></>
          ) : (
            <><div className="pc-mid">Kies je membership</div><div className="pc-foot"><span>Vanaf 95 credits per maand</span><span>→</span></div></>
          )}
        </Link>

        {/* Next appointment */}
        {next ? (
          <div className="card next-card">
            <div className="label-sm">Volgende afspraak</div>
            <Link href={`/app/afspraken/${next.id}`} className="next-main">
              <div className="thumb" style={next.salons?.cover_url ? undefined : placeholderStyle(next.salons?.name ?? "B")}>
                {next.salons?.cover_url ? <img src={next.salons.cover_url} alt="" /> : <span className="initial">{next.salons?.name?.charAt(0)}</span>}
              </div>
              <div className="grow">
                <div className="next-when">{relativeDay(next.starts_at)} · {time(next.starts_at)}</div>
                <b>{next.treatments?.name}</b>
                <div className="small muted">{next.salons?.name} · {next.salons?.district}</div>
              </div>
            </Link>
            <div className="next-actions">
              <a href={`/app/afspraken/${next.id}/agenda`} className="btn secondary small">Agenda</a>
              {next.salons?.latitude != null && <a href={routeUrl({ lat: next.salons.latitude, lng: next.salons.longitude })} target="_blank" rel="noopener noreferrer" className="btn secondary small">Route</a>}
              <Link href={`/app/afspraken/${next.id}`} className="btn secondary small">Details</Link>
            </div>
            {upcoming!.length > 1 && <Link href="/app/afspraken" className="small muted">+ {upcoming!.length - 1} meer gepland →</Link>}
          </div>
        ) : (
          <Link href={active ? "/app/boeken?sort=soon" : "/app/membership"} className="photo-card" style={{ backgroundImage: `linear-gradient(180deg, rgba(34,20,27,0) 30%, rgba(34,20,27,.75)), url(${PHOTOS.canalWoman.small})` }}>
            <span className="label-sm" style={{ color: "rgba(255,255,255,.85)" }}>Nog niets gepland</span>
            <b>Tijd voor iets moois?</b>
            <span className="btn small" style={{ alignSelf: "flex-start" }}>{active ? "Boek een behandeling" : "Kies je membership"}</span>
          </Link>
        )}
      </div>

      {active && (
        <section className="section">
          <h2 style={{ marginBottom: 12 }}>Waar heb je zin in?</h2>
          <div className="quick">
            {(treatments ?? []).map((t: any) => (
              <Link key={t.slug} href={`/app/boeken?t=${t.slug}&sort=${me ? "distance" : "soon"}`} className={`quick-item${t.credits > balance ? " off" : ""}`}>
                <b>{t.name}</b><span>{t.credits} credits</span>
              </Link>
            ))}
          </div>
          {affordable.length === 0 && <p className="small muted" style={{ marginTop: 8 }}>Je tegoed is bijna op. Op {membership?.current_period_end ? dateShort(membership.current_period_end) : "je volgende maand"} krijg je nieuwe credits.</p>}
        </section>
      )}

      {nearby.length > 0 && (
        <section className="section">
          <div className="card-head" style={{ marginBottom: 12 }}>
            <h2>{me ? "Bij jou in de buurt" : "Populaire salons"}</h2>
            <Link href="/app/boeken" className="small">Alles →</Link>
          </div>
          <div className="carousel">
            {nearby.map((s) => (
              <Link key={s.id} href={`/app/boeken/${s.id}`} className="salon-tile">
                <div className="tile-img" style={s.cover ? undefined : placeholderStyle(s.name)}>
                  {s.cover ? <img src={s.cover} alt="" loading="lazy" /> : <span className="initial">{s.name.charAt(0)}</span>}
                  {s.favorite && <span className="tile-fav">♥</span>}
                </div>
                <div className="tile-body">
                  <b>{s.name}</b>
                  <div className="small muted">
                    {s.distance != null ? `${formatDistance(s.distance)} · 🚲 ${bikeMinutes(s.distance)} min` : s.district}
                    {s.rating != null && <> · <span className="stars">★</span> {s.rating.toFixed(1).replace(".", ",")}</>}
                  </div>
                  {s.nextSlot && <span className="next-slot" style={{ marginTop: 6, display: "inline-block" }}>{nextLabel(s.nextSlot)}</span>}
                </div>
              </Link>
            ))}
          </div>
          {!me && <p className="small muted" style={{ marginTop: 8 }}>Tip: vul je postcode in bij <Link href="/app/profiel">je profiel</Link> om salons in de buurt te zien.</p>}
        </section>
      )}

      {active && last && (
        <section className="section">
          <Link href={`/app/boeken/${(last as any).salon_id}?t=${(last as any).treatments?.slug}`} className="card rebook">
            <div className="grow"><div className="label-sm">Boek opnieuw</div><b>{(last as any).treatments?.name}</b> <span className="muted small">bij {(last as any).salons?.name}</span></div>
            <span className="btn small">Kies tijd</span>
          </Link>
        </section>
      )}

      {upcoming && upcoming.length > 1 && (
        <section className="section">
          <h2 style={{ marginBottom: 12 }}>Ook gepland</h2>
          <div className="list">
            {upcoming.slice(1).map((b: any) => (
              <Link key={b.id} href={`/app/afspraken/${b.id}`} className="row-item" style={{ textDecoration: "none" }}>
                <div className="grow"><b>{b.treatments?.name}</b><div className="small muted">{b.salons?.name} · {relativeDay(b.starts_at)} {time(b.starts_at)}</div></div>
                <StatusBadge status="booked" />
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
