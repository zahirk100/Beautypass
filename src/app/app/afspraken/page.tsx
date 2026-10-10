import Link from "next/link";
import { getContext } from "@/lib/auth";
import { routeUrl } from "@/lib/geo";
import { dateLong, time } from "@/lib/format";
import { Flash } from "@/components/Flash";
import { Submit } from "@/components/Submit";
import { StatusBadge } from "@/components/Badge";
import { DateBox } from "@/components/DateBox";
import { cancelBooking, leaveReview } from "../actions";

export const metadata = { title: "Afspraken" };

export default async function Appointments({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const { supabase, user } = await getContext();
  const [{ data: bookings }, { data: reviews }] = await Promise.all([
    supabase.from("bookings").select("id, salon_id, starts_at, status, credits, salons(name, district, latitude, longitude), treatments(name, slug)")
      .eq("user_id", user.id).order("starts_at", { ascending: false }).limit(100),
    supabase.from("reviews").select("booking_id").eq("user_id", user.id),
  ]);
  const now = Date.now();
  const reviewed = new Set((reviews ?? []).map((r: any) => r.booking_id));
  const upcoming = (bookings ?? []).filter((b: any) => b.status === "booked" && new Date(b.starts_at).getTime() > now).reverse();
  const past = (bookings ?? []).filter((b: any) => !upcoming.includes(b));

  return (
    <>
      <div className="page-head"><div><h1>Je <em>afspraken</em></h1><p>Gratis annuleren tot 24 uur vooraf. Daarna blijven de credits bij de salon.</p></div></div>
      <Flash params={sp} />

      <h2 style={{ marginBottom: 14 }}>Gepland</h2>
      {upcoming.length === 0 ? <div className="card empty">Geen geplande afspraken.</div> : (
        <div className="list">
          {upcoming.map((b: any) => {
            const late = new Date(b.starts_at).getTime() - now < 24 * 3600 * 1000;
            return (
              <div className="row-item" key={b.id}>
                <DateBox iso={b.starts_at} />
                <Link href={`/app/afspraken/${b.id}`} className="grow" style={{ textDecoration: "none" }}>
                  <b>{b.treatments?.name}</b>
                  <div className="small muted">{b.salons?.name} · <span className="cap" style={{ display: "inline-block" }}>{dateLong(b.starts_at)}</span> om {time(b.starts_at)} · {b.credits} credits</div>
                </Link>
                <a className="btn secondary small" href={`/app/afspraken/${b.id}/agenda`}>Agenda</a>
                {b.salons?.latitude != null && <a className="btn secondary small" target="_blank" rel="noopener noreferrer" href={routeUrl({ lat: b.salons.latitude, lng: b.salons.longitude })}>Route</a>}
                <form action={cancelBooking}>
                  <input type="hidden" name="booking" value={b.id} />
                  <Submit className="btn danger small" confirm={late ? "Deze afspraak is binnen 24 uur. Je krijgt je credits niet terug. Toch annuleren?" : "Weet je zeker dat je wilt annuleren?"}>Annuleren</Submit>
                </form>
              </div>
            );
          })}
        </div>
      )}

      <section className="section">
        <h2>Eerder</h2>
        {past.length === 0 ? <div className="card empty">Nog geen eerdere afspraken.</div> : (
          <div className="list">
            {past.map((b: any) => (
              <div className="row-item" key={b.id} style={{ flexWrap: "wrap" }}>
                <DateBox iso={b.starts_at} />
                <div className="grow">
                  <b>{b.treatments?.name}</b>
                  <div className="small muted">{b.salons?.name} · {time(b.starts_at)} · {b.credits} credits</div>
                </div>
                <StatusBadge status={b.status} />
                {b.status === "completed" && <Link href={`/app/boeken/${b.salon_id}?t=${b.treatments?.slug}`} className="btn secondary small">Boek opnieuw</Link>}
                {b.status === "completed" && !reviewed.has(b.id) && (
                  <details className="more" style={{ flexBasis: "100%" }}>
                    <summary>Beoordeel deze afspraak</summary>
                    <form action={leaveReview} className="form-grid">
                      <input type="hidden" name="booking" value={b.id} />
                      <input type="hidden" name="salon" value={b.salon_id} />
                      <label className="field">Sterren
                        <select name="rating" defaultValue="5">{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{"★".repeat(n)}</option>)}</select>
                      </label>
                      <label className="field" style={{ gridColumn: "span 2" }}>Opmerking <span className="hint">(optioneel)</span><input name="comment" maxLength={1000} /></label>
                      <Submit className="btn small">Versturen</Submit>
                    </form>
                  </details>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
