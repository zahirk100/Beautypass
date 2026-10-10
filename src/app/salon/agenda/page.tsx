import { dateLong, dayKey, time } from "@/lib/format";
import { Flash } from "@/components/Flash";
import { Submit } from "@/components/Submit";
import { StatusBadge } from "@/components/Badge";
import { BookingActions } from "@/components/BookingActions";
import { getSalonContext } from "../context";
import { addSlots, deleteSlot } from "../actions";

export const metadata = { title: "Agenda" };

export default async function Agenda({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const { supabase, salonId } = await getSalonContext();
  const from = new Date(Date.now() - 6 * 3600e3);
  const to = new Date(Date.now() + 21 * 864e5);
  const [{ data: slots }, { data: bookings }] = await Promise.all([
    supabase.from("slots").select("id, starts_at, ends_at, status").eq("salon_id", salonId)
      .gte("starts_at", from.toISOString()).lt("starts_at", to.toISOString()).order("starts_at"),
    supabase.rpc("salon_bookings", { p_salon: salonId, p_from: from.toISOString(), p_to: to.toISOString() }),
  ]);
  const bySlot = new Map<string, any>();
  (bookings ?? []).forEach((b: any) => { if (["booked", "completed", "no_show", "cancelled_late"].includes(b.status)) bySlot.set(b.starts_at, b); });
  const days = new Map<string, any[]>();
  (slots ?? []).forEach((s: any) => { const k = dayKey(s.starts_at); days.set(k, [...(days.get(k) ?? []), s]); });
  const today = dayKey(new Date().toISOString());

  return (
    <>
      <div className="page-head"><div><h1>Agenda</h1><p>Zet tijden open voor BeautyPass-members. Tip: geef vooral je rustige uren vrij.</p></div></div>
      <Flash params={sp} />

      <form action={addSlots} className="card grid">
        <h2>Vrije tijden toevoegen</h2>
        <div className="form-grid">
          <label className="field">Datum<input type="date" name="date" min={today} defaultValue={today} required /></label>
          <label className="field">Van<input type="time" name="from" defaultValue="10:00" step={900} required /></label>
          <label className="field">Tot<input type="time" name="to" defaultValue="13:00" step={900} required /></label>
          <label className="field">Duur per afspraak
            <select name="duration" defaultValue="60">{[30, 45, 60, 75, 90, 120].map((m) => <option key={m} value={m}>{m} min</option>)}</select>
          </label>
          <label className="field">Herhalen
            <select name="weeks" defaultValue="1">{[1, 2, 3, 4, 6, 8].map((w) => <option key={w} value={w}>{w === 1 ? "Alleen deze dag" : `${w} weken wekelijks`}</option>)}</select>
          </label>
          <Submit>Toevoegen</Submit>
        </div>
      </form>

      <section className="section">
        <h2>Komende 3 weken</h2>
        {days.size === 0 ? <div className="card empty">Nog geen tijden. Voeg hierboven je eerste vrije tijden toe.</div> : (
          <div className="grid" style={{ gap: 16 }}>
            {[...days.entries()].map(([day, list]) => (
              <div key={day} className="card">
                <h3 className="cap" style={{ marginBottom: 12 }}>{dateLong(list[0].starts_at)}</h3>
                <div className="list">
                  {list.map((s: any) => {
                    const b = bySlot.get(s.starts_at);
                    return (
                      <div key={s.id} className="row-item" style={{ padding: "10px 14px", flexWrap: "wrap" }}>
                        <b style={{ width: 110 }}>{time(s.starts_at)}–{time(s.ends_at)}</b>
                        <div className="grow">{b ? <>{b.member_name} · {b.treatment}{b.note && <><br /><span className="note">“{b.note}”</span></>}</> : <span className="muted">Vrij voor members</span>}</div>
                        <StatusBadge status={b ? b.status : s.status} />
                        {b ? <BookingActions id={b.id} status={b.status} startsAt={b.starts_at} backTo="/salon/agenda" /> : s.status !== "booked" && (
                          <form action={deleteSlot}><input type="hidden" name="slot" value={s.id} /><Submit className="btn secondary small">Verwijder</Submit></form>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
