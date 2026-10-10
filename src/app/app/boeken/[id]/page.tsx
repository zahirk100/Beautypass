import Link from "next/link";
import { notFound } from "next/navigation";
import { getContext } from "@/lib/auth";
import { dateLong, dayKey, time } from "@/lib/format";
import { Flash } from "@/components/Flash";
import { Submit } from "@/components/Submit";
import { loadMembership } from "../../data";
import { bookSlot } from "../../actions";

export default async function SalonBooking({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, user } = await getContext();
  const { data: salon } = await supabase.from("salons").select("*").eq("id", id).eq("status", "active").maybeSingle();
  if (!salon) notFound();

  const [{ data: offers }, { data: slots }, { membership, balance }] = await Promise.all([
    supabase.from("salon_treatments").select("credits_override, treatments(id, name, credits, description, duration_min)").eq("salon_id", id).eq("active", true),
    supabase.from("slots").select("id, starts_at").eq("salon_id", id).eq("status", "open").gt("starts_at", new Date().toISOString()).order("starts_at").limit(120),
    loadMembership(supabase, user.id),
  ]);
  const treatments = (offers ?? []).map((o: any) => ({ ...o.treatments, credits: o.credits_override ?? o.treatments?.credits })).filter((t: any) => t.id);
  const days = new Map<string, any[]>();
  (slots ?? []).forEach((s: any) => { const k = dayKey(s.starts_at); days.set(k, [...(days.get(k) ?? []), s]); });
  const canBook = membership?.status === "active";

  return (
    <>
      <Link href="/app/boeken" className="small muted">← Alle salons</Link>
      <div className="page-head" style={{ marginTop: 10 }}>
        <div><h1>{salon.name}</h1><p>{[salon.district, salon.address].filter(Boolean).join(" · ") || "Amsterdam"}</p></div>
        <span className="badge">{balance} credits beschikbaar</span>
      </div>
      {salon.description && <p className="muted" style={{ maxWidth: 680, marginBottom: 22 }}>{salon.description}</p>}
      <Flash params={sp} />

      {!canBook && (
        <div className="flash error">Je kunt boeken zodra je membership actief is. <Link href="/app/membership">Bekijk je membership</Link></div>
      )}

      <form action={bookSlot} className="grid" style={{ gap: 24 }}>
        <input type="hidden" name="salon" value={salon.id} />
        <div className="card">
          <h2 style={{ marginBottom: 14 }}>1. Kies je behandeling</h2>
          <div className="list">
            {treatments.map((t: any) => (
              <label key={t.id} className="row-item" style={{ cursor: "pointer" }}>
                <input type="radio" name="treatment" value={t.id} required style={{ width: "auto" }} disabled={t.credits > balance} />
                <div className="grow"><b>{t.name}</b><div className="small muted">{t.description} · ±{t.duration_min} min</div></div>
                <span className={`badge${t.credits > balance ? " neutral" : ""}`}>{t.credits} credits</span>
              </label>
            ))}
            {treatments.length === 0 && <p className="muted">Deze salon heeft nog geen behandelingen online.</p>}
          </div>
        </div>

        <div className="card">
          <h2 style={{ marginBottom: 14 }}>2. Kies een tijd</h2>
          {days.size === 0 && <p className="muted">Er zijn op dit moment geen vrije tijden. Kijk later nog eens, of probeer een andere salon.</p>}
          <div className="grid" style={{ gap: 18 }}>
            {[...days.entries()].map(([day, list]) => (
              <div key={day}>
                <p className="cap" style={{ fontWeight: 600, marginBottom: 8 }}>{dateLong(list[0].starts_at)}</p>
                <div className="slot-grid">
                  {list.map((s: any) => (
                    <label key={s.id} className="slot-option"><input type="radio" name="slot" value={s.id} required /><span>{time(s.starts_at)}</span></label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="inline-form">
          <Submit className="btn">Bevestig boeking</Submit>
          <span className="small muted">Gratis annuleren tot 24 uur vooraf.</span>
        </div>
      </form>
    </>
  );
}
