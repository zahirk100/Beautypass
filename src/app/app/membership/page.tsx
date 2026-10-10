import { getContext } from "@/lib/auth";
import { dateShort, euro } from "@/lib/format";
import { Flash } from "@/components/Flash";
import { Submit } from "@/components/Submit";
import { StatusBadge } from "@/components/Badge";
import { loadMembership } from "../data";
import { requestMembership } from "../actions";

export const metadata = { title: "Membership" };

export default async function MembershipPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const { supabase, user } = await getContext();
  const { membership, balance } = await loadMembership(supabase, user.id);
  const [{ data: plans }, { data: treatments }] = await Promise.all([
    supabase.from("plans").select("*").eq("active", true).order("sort"),
    supabase.from("treatments").select("name, credits").eq("active", true).order("sort"),
  ]);

  return (
    <>
      <div className="page-head">
        <div><h1>Jouw <em>membership</em></h1><p>Elke maand een vast tegoed aan credits, en jij kiest waaraan je het besteedt.</p></div>
      </div>
      <Flash params={sp} />

      {membership && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-head"><h2>{membership.plans?.name}</h2><StatusBadge status={membership.status} /></div>
          <div className="grid stats">
            <div className="stat"><div className="label">Prijs</div><div className="value">{euro(membership.plans?.monthly_price_cents)}</div><div className="sub">per maand</div></div>
            <div className="stat"><div className="label">Credits per maand</div><div className="value">{membership.plans?.monthly_credits}</div></div>
            <div className="stat"><div className="label">Huidig tegoed</div><div className="value">{balance}</div></div>
            {membership.current_period_end && <div className="stat"><div className="label">Volgende maand</div><div className="value" style={{ fontSize: "1.3rem" }}>{dateShort(membership.current_period_end)}</div></div>}
          </div>
          {membership.status === "pending" && <p className="muted small" style={{ marginTop: 16 }}>We nemen contact met je op om je membership en de betaling te starten.</p>}
          <p className="muted small" style={{ marginTop: 12 }}>Wil je pauzeren, wisselen of opzeggen? Neem contact op met het BeautyPass-team.</p>
        </div>
      )}

      {!membership && (
        <div className="grid three">
          {(plans ?? []).map((p: any) => (
            <form action={requestMembership} key={p.id} className={`card plan${p.slug === "signature" ? " featured" : ""}`}>
              <input type="hidden" name="plan" value={p.id} />
              <div>
                {p.slug === "signature" && <span className="badge">Meest gekozen</span>}
                <h2 style={{ marginTop: 8 }}>{p.name}</h2>
                <p className="muted small">{p.tagline}</p>
              </div>
              <div className="price">{euro(p.monthly_price_cents)} <small>per maand</small></div>
              <ul>
                <li><b>{p.monthly_credits} credits</b> per maand</li>
                <li>Tot {p.rollover_max} credits mee naar de volgende maand</li>
                <li>Boeken bij alle aangesloten salons</li>
                <li>Gratis annuleren tot 24 uur vooraf</li>
              </ul>
              <Submit className={p.slug === "signature" ? "btn block" : "btn secondary block"}>Kies {p.name}</Submit>
            </form>
          ))}
        </div>
      )}

      <section className="section">
        <h2>Wat kost een behandeling?</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Behandeling</th><th>Credits</th></tr></thead>
            <tbody>{(treatments ?? []).map((t: any) => <tr key={t.name}><td>{t.name}</td><td>{t.credits}</td></tr>)}</tbody>
          </table>
        </div>
        <p className="small muted" style={{ marginTop: 10 }}>Sommige salons kunnen een afwijkend aantal credits rekenen. Dat zie je altijd vóór het boeken.</p>
      </section>
    </>
  );
}
