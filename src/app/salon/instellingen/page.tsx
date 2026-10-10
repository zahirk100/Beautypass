import { euro, roleLabel } from "@/lib/format";
import { Flash } from "@/components/Flash";
import { Submit } from "@/components/Submit";
import { getSalonContext } from "../context";
import { addStaff, removeStaff, updateSalonProfile } from "../actions";

export const metadata = { title: "Salon & team" };

export default async function Settings({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const { supabase, salonId, isOwner, user } = await getSalonContext();
  const [{ data: salon }, { data: offers }, { data: team }] = await Promise.all([
    supabase.from("salons").select("*").eq("id", salonId).single(),
    supabase.from("salon_treatments").select("credits_override, payout_cents, active, treatments(name, credits)").eq("salon_id", salonId),
    supabase.rpc("salon_team", { p_salon: salonId }),
  ]);

  return (
    <>
      <div className="page-head"><div><h1>Salon &amp; team</h1><p>Je profiel zoals members het zien, je behandelingen en je team.</p></div></div>
      <Flash params={sp} />
      <div className="grid two">
        <form action={updateSalonProfile} className="card grid">
          <h2>Salonprofiel</h2>
          <label className="field">Wijk<input name="district" defaultValue={salon?.district ?? ""} disabled={!isOwner} /></label>
          <label className="field">Adres<input name="address" defaultValue={salon?.address ?? ""} disabled={!isOwner} /></label>
          <label className="field">Postcode <span className="hint">members zien hiermee hoe ver je salon is</span><input name="postcode" defaultValue={salon?.postcode ?? ""} disabled={!isOwner} /></label>
          <label className="field">Over de salon<textarea name="description" defaultValue={salon?.description ?? ""} maxLength={2000} disabled={!isOwner} /></label>
          {isOwner ? <div><Submit>Opslaan</Submit></div> : <p className="small muted">Alleen de eigenaar kan het profiel aanpassen.</p>}
        </form>

        <div className="card">
          <h2 style={{ marginBottom: 12 }}>Behandelingen</h2>
          <div className="table-wrap" style={{ border: 0 }}>
            <table>
              <thead><tr><th>Behandeling</th><th>Credits</th><th>Je ontvangt</th></tr></thead>
              <tbody>
                {(offers ?? []).map((o: any, i: number) => (
                  <tr key={i} style={{ opacity: o.active ? 1 : .5 }}><td>{o.treatments?.name}</td><td>{o.credits_override ?? o.treatments?.credits}</td><td>{euro(o.payout_cents)}</td></tr>
                ))}
                {(offers ?? []).length === 0 && <tr><td colSpan={3} className="empty">Nog geen behandelingen ingesteld.</td></tr>}
              </tbody>
            </table>
          </div>
          <p className="small muted" style={{ marginTop: 10 }}>Wil je iets wijzigen? Neem contact op met het BeautyPass-team.</p>
        </div>
      </div>

      <section className="section card">
        <h2 style={{ marginBottom: 12 }}>Team</h2>
        <div className="list">
          {(team ?? []).map((m: any) => (
            <div key={m.user_id} className="row-item" style={{ padding: "10px 14px" }}>
              <div className="grow"><b>{m.name || m.email}</b>{m.user_id === user.id && " (jij)"} · <span className="muted">{roleLabel[m.role]} · {m.email}</span></div>
              {isOwner && m.role === "staff" && (
                <form action={removeStaff}><input type="hidden" name="user" value={m.user_id} /><Submit className="btn danger small" confirm="Deze medewerker verwijderen?">Verwijderen</Submit></form>
              )}
            </div>
          ))}
        </div>
        {isOwner && (
          <form action={addStaff} className="inline-form" style={{ marginTop: 16 }}>
            <input type="email" name="email" placeholder="E-mailadres medewerker" required style={{ minWidth: 260 }} />
            <Submit className="btn small">Medewerker toevoegen</Submit>
            <span className="small muted">Je medewerker maakt eerst zelf een account aan via de inlogpagina.</span>
          </form>
        )}
      </section>
    </>
  );
}
