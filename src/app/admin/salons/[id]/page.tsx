import Link from "next/link";
import { notFound } from "next/navigation";
import { can, ADMIN_WRITE } from "@/lib/auth";
import { currentMonth, dateShort, euro, roleLabel, time } from "@/lib/format";
import { Flash } from "@/components/Flash";
import { Submit } from "@/components/Submit";
import { StatusBadge } from "@/components/Badge";
import { getAdminContext } from "../../context";
import { addSalonMember, removeSalonMember, removeSalonTreatment, updateSalon, upsertSalonTreatment } from "../../actions";

export default async function SalonDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, role } = await getAdminContext();
  const { data: salon } = await supabase.from("salons").select("*").eq("id", id).maybeSingle();
  if (!salon) notFound();
  const [{ data: treatments }, { data: offers }, { data: team }, { data: payouts }, { data: bookings }, { data: reviews }] = await Promise.all([
    supabase.from("treatments").select("*").order("sort"),
    supabase.from("salon_treatments").select("*").eq("salon_id", id),
    supabase.rpc("salon_team", { p_salon: id }),
    supabase.rpc("salon_payouts", { p_month: currentMonth() }),
    supabase.rpc("salon_bookings", { p_salon: id, p_from: new Date(Date.now() - 30 * 864e5).toISOString(), p_to: new Date(Date.now() + 30 * 864e5).toISOString() }),
    supabase.from("reviews").select("rating, comment, created_at").eq("salon_id", id).order("created_at", { ascending: false }).limit(10),
  ]);
  const ops = can(role, ADMIN_WRITE.ops);
  const offer = (tid: string) => (offers ?? []).find((o: any) => o.treatment_id === tid);
  const pay = (payouts ?? []).find((p: any) => p.salon_id === id);

  return (
    <>
      <Link href="/admin/salons" className="small muted">← Alle salons</Link>
      <div className="page-head" style={{ marginTop: 10 }}>
        <div><h1>{salon.name}</h1><p>{salon.district || "Amsterdam"} · deze maand {pay?.bookings ?? 0} afspraken · {euro(pay?.payout_cents ?? 0)} uit te betalen</p></div>
        <StatusBadge status={salon.status} />
      </div>
      <Flash params={sp} />

      <div className="grid two">
        <form action={updateSalon} className="card grid">
          <h2>Gegevens</h2>
          <input type="hidden" name="id" value={salon.id} />
          <div className="form-grid">
            <label className="field">Naam<input name="name" defaultValue={salon.name} required disabled={!ops} /></label>
            <label className="field">Status
              <select name="status" defaultValue={salon.status} disabled={!ops}>
                <option value="lead">Lead (in gesprek)</option><option value="active">Live</option><option value="paused">Gepauzeerd</option>
              </select>
            </label>
            <label className="field">Wijk<input name="district" defaultValue={salon.district} disabled={!ops} /></label>
            <label className="field">Adres<input name="address" defaultValue={salon.address} disabled={!ops} /></label>
            <label className="field">Contactpersoon<input name="contact_name" defaultValue={salon.contact_name} disabled={!ops} /></label>
            <label className="field">E-mail<input name="contact_email" defaultValue={salon.contact_email} disabled={!ops} /></label>
            <label className="field">Telefoon<input name="contact_phone" defaultValue={salon.contact_phone} disabled={!ops} /></label>
          </div>
          <label className="field">Beschrijving (zichtbaar voor members)<textarea name="description" defaultValue={salon.description} disabled={!ops} /></label>
          <label className="field">Interne notities <span className="hint">(alleen zichtbaar voor het team)</span><textarea name="notes" defaultValue={salon.notes} disabled={!ops} /></label>
          {ops && <div><Submit>Opslaan</Submit></div>}
        </form>

        <div className="grid" style={{ alignContent: "start" }}>
          <div className="card">
            <h2 style={{ marginBottom: 12 }}>Team van de salon</h2>
            <div className="list">
              {(team ?? []).map((m: any) => (
                <div key={m.user_id} className="row-item" style={{ padding: "10px 14px" }}>
                  <div className="grow"><b>{m.name || m.email}</b><div className="small muted">{m.email} · {roleLabel[m.role]}</div></div>
                  {ops && <form action={removeSalonMember}><input type="hidden" name="salon" value={id} /><input type="hidden" name="user" value={m.user_id} /><Submit className="btn danger small" confirm="Ontkoppelen?">Ontkoppel</Submit></form>}
                </div>
              ))}
              {(team ?? []).length === 0 && <p className="muted small">Nog niemand gekoppeld. De eigenaar maakt eerst een account aan op de inlogpagina.</p>}
            </div>
            {ops && (
              <form action={addSalonMember} className="inline-form" style={{ marginTop: 14 }}>
                <input type="hidden" name="salon" value={id} />
                <input type="email" name="email" placeholder="E-mailadres van account" required />
                <select name="role" defaultValue="owner"><option value="owner">Eigenaar</option><option value="staff">Medewerker</option></select>
                <Submit className="btn small">Koppel</Submit>
              </form>
            )}
          </div>
          <div className="card">
            <h2 style={{ marginBottom: 12 }}>Beoordelingen</h2>
            {(reviews ?? []).length === 0 ? <p className="muted small">Nog geen beoordelingen.</p> : (
              <div className="list">{(reviews ?? []).map((r: any, i: number) => <div key={i} className="small"><b>{"★".repeat(r.rating)}</b> <span className="muted">{dateShort(r.created_at)}</span>{r.comment && <div>{r.comment}</div>}</div>)}</div>
            )}
          </div>
        </div>
      </div>

      <section className="section">
        <h2>Behandelingen &amp; tarieven</h2>
        <p className="small muted" style={{ margin: "-6px 0 12px" }}>Uitbetaling = wat de salon per behandeling van ons ontvangt (incl. btw). Laat credits leeg voor de standaard.</p>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Behandeling</th><th>Normale prijs</th><th>Standaard</th><th>Instellingen voor deze salon</th><th></th></tr></thead>
            <tbody>
              {(treatments ?? []).map((t: any) => {
                const o = offer(t.id);
                return (
                  <tr key={t.id} style={{ opacity: o ? 1 : .65 }}>
                    <td><b>{t.name}</b></td>
                    <td>{euro(t.retail_price_cents)}</td>
                    <td className="small">{t.credits} credits · {euro(t.default_payout_cents)}</td>
                    <td>
                      {ops ? (
                        <form action={upsertSalonTreatment} className="inline-form">
                          <input type="hidden" name="salon" value={id} /><input type="hidden" name="treatment" value={t.id} />
                          <label className="small">€ <input name="payout" type="number" step="0.01" min="0" defaultValue={((o?.payout_cents ?? t.default_payout_cents) / 100).toFixed(2)} /></label>
                          <label className="small">credits <input name="credits_override" type="number" min="1" placeholder={String(t.credits)} defaultValue={o?.credits_override ?? ""} /></label>
                          <label className="small" style={{ display: "flex", gap: 4, alignItems: "center" }}><input type="checkbox" name="active" defaultChecked={o ? o.active : true} style={{ width: "auto" }} />actief</label>
                          <Submit className="btn small">{o ? "Opslaan" : "Toevoegen"}</Submit>
                        </form>
                      ) : o ? <span className="small">{euro(o.payout_cents)} · {o.credits_override ?? t.credits} credits</span> : <span className="muted small">Niet aangeboden</span>}
                    </td>
                    <td>{ops && o && <form action={removeSalonTreatment}><input type="hidden" name="salon" value={id} /><input type="hidden" name="treatment" value={t.id} /><Submit className="btn danger small" confirm="Behandeling bij deze salon verwijderen?">Verwijder</Submit></form>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section">
        <h2>Afspraken (30 dagen terug en vooruit)</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Wanneer</th><th>Member</th><th>Behandeling</th><th>Status</th><th>Uitbetaling</th></tr></thead>
            <tbody>
              {(bookings ?? []).map((b: any) => <tr key={b.id}><td>{dateShort(b.starts_at)} {time(b.starts_at)}</td><td>{b.member_name}</td><td>{b.treatment}</td><td><StatusBadge status={b.status} /></td><td>{euro(b.payout_cents)}</td></tr>)}
              {(bookings ?? []).length === 0 && <tr><td colSpan={5} className="empty">Geen afspraken.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
