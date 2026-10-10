import Link from "next/link";
import { currentMonth, dateLong, dateShort, dayKey, euro, time } from "@/lib/format";
import { Submit } from "@/components/Submit";
import { addSlots } from "./actions";
import { Flash } from "@/components/Flash";
import { StatusBadge } from "@/components/Badge";
import { BookingActions } from "@/components/BookingActions";
import { getSalonContext } from "./context";

export default async function SalonToday({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const { supabase, salonId, current } = await getSalonContext();
  const now = new Date();
  const dayStart = new Date(now.getTime() - 12 * 3600e3);
  const weekEnd = new Date(now.getTime() + 7 * 864e5);
  const month = currentMonth();

  const [{ data: bookings }, { data: payouts }, { count: openSlots }, { data: reviews }, { data: recent }] = await Promise.all([
    supabase.rpc("salon_bookings", { p_salon: salonId, p_from: dayStart.toISOString(), p_to: weekEnd.toISOString() }),
    supabase.rpc("salon_payouts", { p_month: month }),
    supabase.from("slots").select("id", { count: "exact", head: true }).eq("salon_id", salonId).eq("status", "open").gt("starts_at", now.toISOString()),
    supabase.from("reviews").select("rating").eq("salon_id", salonId),
    supabase.rpc("salon_recent_reviews", { p_salon: salonId, p_limit: 3 }),
  ]);
  const mine = (payouts ?? []).find((p: any) => p.salon_id === salonId);
  const ratings = (reviews ?? []).map((r: any) => r.rating);
  const avg = ratings.length ? (ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length).toFixed(1) : "–";
  const active = (bookings ?? []).filter((b: any) => ["booked", "completed", "no_show"].includes(b.status));
  const nextUp: any = (bookings ?? []).find((b: any) => b.status === "booked" && new Date(b.starts_at).getTime() > Date.now() - 45 * 60e3);
  const { data: me } = await supabase.from("salons").select("cover_url, tagline, description, opening_hours, gallery, latitude").eq("id", salonId).single();
  const missing = me ? [!me.cover_url, !me.tagline, !me.description, !me.opening_hours, (me.gallery ?? []).length < 3, me.latitude == null].filter(Boolean).length : 0;
  const tomorrow = dayKey(new Date(Date.now() + 864e5).toISOString());

  return (
    <>
      <div className="page-head"><div><h1>Goedendag, <em>{current.salons?.name}</em></h1><p>Je afspraken voor de komende 7 dagen.</p></div></div>
      <Flash params={sp} />
      <div className="grid two" style={{ marginBottom: 18, alignItems: "stretch" }}>
        {nextUp ? (
          <div className="card dark next-card">
            <div className="label-sm" style={{ color: "var(--champagne)" }}>Volgende afspraak</div>
            <div className="pc-mid">{time(nextUp.starts_at)} · {nextUp.member_name}</div>
            <div style={{ color: "rgba(251,247,242,.75)" }}><span className="cap" style={{ display: "inline-block" }}>{dateLong(nextUp.starts_at)}</span> · {nextUp.treatment}</div>
            {nextUp.note && <span className="note" style={{ alignSelf: "flex-start" }}>“{nextUp.note}”</span>}
            <BookingActions id={nextUp.id} status={nextUp.status} startsAt={nextUp.starts_at} backTo="/salon" />
          </div>
        ) : (
          <div className="card dark next-card"><div className="label-sm" style={{ color: "var(--champagne)" }}>Volgende afspraak</div><div className="pc-mid">Nog niets gepland</div><p style={{ color: "rgba(251,247,242,.75)" }}>Zet vrije tijden open, dan kunnen members je vinden.</p></div>
        )}
        <div className="card grid" style={{ alignContent: "start" }}>
          <div className="label-sm" style={{ marginBottom: 0 }}>Snel vrije tijden openzetten</div>
          <div className="inline-form">
            {[["10:00", "13:00", "Morgen 10–13"], ["13:00", "17:00", "Morgen 13–17"]].map(([from, to, label]) => (
              <form key={label} action={addSlots}>
                <input type="hidden" name="date" value={tomorrow} /><input type="hidden" name="from" value={from} /><input type="hidden" name="to" value={to} />
                <input type="hidden" name="duration" value="60" /><input type="hidden" name="weeks" value="1" />
                <Submit className="btn secondary small">+ {label}</Submit>
              </form>
            ))}
            <Link href="/salon/agenda" className="btn secondary small">Meer opties →</Link>
          </div>
          {missing > 0 && (
            <Link href="/salon/profiel" className="flash ok" style={{ margin: 0, textDecoration: "none" }}>
              Je profiel mist nog {missing} {missing === 1 ? "onderdeel" : "onderdelen"}. Salons met foto&apos;s worden vaker geboekt →
            </Link>
          )}
        </div>
      </div>
      {current.salons?.status !== "active" && (
        <div className="flash error">Je salon is nog niet zichtbaar voor members (status: {current.salons?.status}). Het BeautyPass-team zet je salon live zodra alles klaar is.</div>
      )}
      <div className="grid stats">
        <div className="card stat"><div className="label">Verdiend deze maand</div><div className="value">{euro(mine?.payout_cents ?? 0)}</div><div className="sub">{mine?.bookings ?? 0} afspraken</div></div>
        <div className="card stat"><div className="label">Komende 7 dagen</div><div className="value">{active.filter((b: any) => b.status === "booked").length}</div><div className="sub">geplande afspraken</div></div>
        <div className="card stat"><div className="label">Vrije tijden</div><div className="value">{openSlots ?? 0}</div><div className="sub">open voor members</div></div>
        <div className="card stat"><div className="label">Beoordeling</div><div className="value">{avg}</div><div className="sub">{ratings.length} reviews</div></div>
      </div>

      <section className="section">
        <h2>Afspraken</h2>
        {active.length === 0 ? <div className="card empty">Geen afspraken in de komende 7 dagen. Voeg vrije tijden toe in de agenda.</div> : (
          <div className="table-wrap">
            <table className="rtable">
              <thead><tr><th>Wanneer</th><th>Member</th><th>Behandeling</th><th>Uitbetaling</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {active.map((b: any) => (
                  <tr key={b.id}>
                    <td className="primary"><span><span className="cap" style={{ display: "inline-block" }}>{dateLong(b.starts_at)}</span> · <b>{time(b.starts_at)}</b></span></td>
                    <td data-label="Member">{b.member_name}</td>
                    <td data-label="Behandeling"><span>{b.treatment}{b.note && <><br /><span className="note">“{b.note}”</span></>}</span></td>
                    <td data-label="Uitbetaling">{euro(b.payout_cents)}</td>
                    <td data-label="Status"><StatusBadge status={b.status} /></td>
                    <td><BookingActions id={b.id} status={b.status} startsAt={b.starts_at} backTo="/salon" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="small muted" style={{ marginTop: 10 }}>Zet een afspraak na afloop op <b>Voltooid</b>, dan telt hij mee voor je uitbetaling. Kwam het lid niet? Kies <b>No-show</b>: je wordt dan toch betaald.</p>
      </section>

      <section className="section">
        <h2>Laatste reviews</h2>
        {(recent ?? []).length === 0 ? <div className="card empty">Nog geen reviews.</div> : (
          <div className="card">
            {(recent ?? []).map((r: any, i: number) => (
              <div key={i} className="review">
                <div className="small"><span className="stars">{"★".repeat(r.rating)}</span> <b>{r.reviewer}</b> <span className="muted">· {dateShort(r.created_at)}</span></div>
                {r.comment && <p className="small" style={{ marginTop: 4 }}>{r.comment}</p>}
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
