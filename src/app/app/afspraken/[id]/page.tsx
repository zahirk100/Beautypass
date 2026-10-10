/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { notFound } from "next/navigation";
import { getContext } from "@/lib/auth";
import { dateLong, time } from "@/lib/format";
import { routeUrl } from "@/lib/geo";
import { placeholderStyle } from "@/lib/social";
import { Flash } from "@/components/Flash";
import { Submit } from "@/components/Submit";
import { StatusBadge } from "@/components/Badge";
import { cancelBooking } from "../../actions";

export const metadata = { title: "Afspraak" };

export default async function BookingDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase } = await getContext();
  const [{ data: b }, { data: balance }] = await Promise.all([
    supabase.from("bookings")
      .select("id, salon_id, starts_at, status, credits, note, salons(name, address, postcode, district, latitude, longitude, cover_url), treatments(name, slug, duration_min)")
      .eq("id", id).maybeSingle(),
    supabase.rpc("my_credit_balance"),
  ]);
  if (!b) notFound();
  const salon: any = b.salons;
  const t: any = b.treatments;
  const fresh = sp.nieuw === "1";
  const upcoming = b.status === "booked" && new Date(b.starts_at).getTime() > Date.now();
  const late = new Date(b.starts_at).getTime() - Date.now() < 24 * 3600e3;

  return (
    <div style={{ maxWidth: 560, margin: "0 auto" }}>
      <Flash params={sp} />
      {fresh ? (
        <div className="confirm">
          <svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="31" fill="#3a1828" /><path d="M20 33l8 8 16-17" fill="none" stroke="#e3c79f" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" /></svg>
          <h1>Je bent <em>geboekt!</em></h1>
          <p className="muted">{b.credits} credits gebruikt · je hebt er nog {balance ?? 0}.</p>
        </div>
      ) : (
        <Link href="/app/afspraken" className="small muted">← Alle afspraken</Link>
      )}

      <div className="card ticket">
        <div className="ticket-cover" style={salon?.cover_url ? undefined : placeholderStyle(salon?.name ?? "B")}>
          {salon?.cover_url ? <img src={salon.cover_url} alt="" /> : <span className="initial">{salon?.name?.charAt(0)}</span>}
        </div>
        <div className="ticket-body">
          <div className="card-head" style={{ marginBottom: 6 }}><h2>{t?.name}</h2><StatusBadge status={b.status} /></div>
          <p><b>{salon?.name}</b></p>
          <div className="ticket-when">
            <div><span className="label">Datum</span><b className="cap">{dateLong(b.starts_at)}</b></div>
            <div><span className="label">Tijd</span><b>{time(b.starts_at)}</b></div>
            <div><span className="label">Duur</span><b>±{t?.duration_min} min</b></div>
          </div>
          {salon?.address && <p className="small muted">{salon.address}{salon.postcode ? `, ${salon.postcode.replace(/^(\d{4})/, "$1 ")}` : ""} · {salon.district}</p>}
          {b.note && <p style={{ marginTop: 8 }}><span className="note">“{b.note}”</span></p>}
        </div>
        {upcoming && (
          <div className="ticket-actions">
            <a href={`/app/afspraken/${b.id}/agenda`} className="btn">Zet in agenda</a>
            {salon?.latitude != null && <a href={routeUrl({ lat: salon.latitude, lng: salon.longitude })} target="_blank" rel="noopener noreferrer" className="btn secondary">Route</a>}
          </div>
        )}
      </div>

      {upcoming && (
        <form action={cancelBooking} style={{ marginTop: 16, textAlign: "center" }}>
          <input type="hidden" name="booking" value={b.id} />
          <input type="hidden" name="back" value={`/app/afspraken/${b.id}`} />
          <Submit className="btn danger small" confirm={late ? "Deze afspraak is binnen 24 uur. Je krijgt je credits niet terug. Toch annuleren?" : "Weet je zeker dat je wilt annuleren? Je krijgt je credits terug."}>Annuleren</Submit>
          <p className="small muted" style={{ marginTop: 8 }}>{late ? "Binnen 24 uur: credits worden niet teruggeboekt." : "Gratis annuleren tot 24 uur vooraf."}</p>
        </form>
      )}

      {fresh && (
        <div style={{ display: "grid", gap: 10, marginTop: 22 }}>
          <Link href="/app" className="btn secondary block">Naar mijn overzicht</Link>
          <Link href="/app/boeken" className="small muted" style={{ textAlign: "center" }}>Nog iets boeken</Link>
        </div>
      )}
      {!upcoming && b.status === "completed" && (
        <Link href={`/app/boeken/${b.salon_id}?t=${t?.slug}`} className="btn block" style={{ marginTop: 16 }}>Boek opnieuw</Link>
      )}
    </div>
  );
}
