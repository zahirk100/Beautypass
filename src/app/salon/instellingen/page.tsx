import { euro, roleLabel } from "@/lib/format";
import { Flash } from "@/components/Flash";
import { Submit } from "@/components/Submit";
import { getSalonContext } from "../context";
import { addStaff, removeStaff } from "../actions";

export const metadata = { title: "Team & behandelingen" };

export default async function Settings({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const { supabase, salonId, isOwner, user } = await getSalonContext();
  const [{ data: offers }, { data: team }] = await Promise.all([
    supabase.from("salon_treatments").select("credits_override, payout_cents, active, treatments(name, credits, duration_min)").eq("salon_id", salonId),
    supabase.rpc("salon_team", { p_salon: salonId }),
  ]);

  return (
    <>
      <div className="page-head"><div><h1>Team &amp; behandelingen</h1><p>Wie er in je salon werkt, en wat je via BeautyPass aanbiedt.</p></div></div>
      <Flash params={sp} />
      <div className="grid two" style={{ alignItems: "start" }}>
        <section className="card">
          <h2 style={{ marginBottom: 12 }}>Team</h2>
          <div className="list">
            {(team ?? []).map((m: any) => (
              <div key={m.user_id} className="row-item" style={{ padding: "10px 14px" }}>
                <div className="grow"><b>{m.name || m.email}</b>{m.user_id === user.id && " (jij)"}<div className="small muted">{roleLabel[m.role]} · {m.email}</div></div>
                {isOwner && m.role === "staff" && (
                  <form action={removeStaff}><input type="hidden" name="user" value={m.user_id} /><Submit className="btn danger small" confirm="Deze medewerker verwijderen?">Verwijderen</Submit></form>
                )}
              </div>
            ))}
          </div>
          {isOwner && (
            <form action={addStaff} className="grid" style={{ marginTop: 16, gap: 10 }}>
              <label className="field">Medewerker toevoegen<input type="email" name="email" placeholder="E-mailadres" required autoCapitalize="none" /></label>
              <Submit className="btn secondary">Toevoegen</Submit>
              <span className="small muted">Je medewerker maakt eerst zelf een account aan via de inlogpagina. Medewerkers zien de agenda, maar kunnen het profiel en team niet wijzigen.</span>
            </form>
          )}
        </section>

        <section className="card">
          <h2 style={{ marginBottom: 12 }}>Behandelingen</h2>
          <div className="list">
            {(offers ?? []).map((o: any, i: number) => (
              <div key={i} className="row-item" style={{ padding: "10px 14px", opacity: o.active ? 1 : .5 }}>
                <div className="grow"><b>{o.treatments?.name}</b><div className="small muted">±{o.treatments?.duration_min} min · {o.credits_override ?? o.treatments?.credits} credits voor het lid</div></div>
                <div style={{ textAlign: "right" }}><b>{euro(o.payout_cents)}</b><div className="small muted">je ontvangt</div></div>
              </div>
            ))}
            {(offers ?? []).length === 0 && <p className="muted">Nog geen behandelingen ingesteld.</p>}
          </div>
          <p className="small muted" style={{ marginTop: 10 }}>Iets aanpassen of toevoegen? Neem contact op met het BeautyPass-team.</p>
        </section>
      </div>
    </>
  );
}
