import { can, ADMIN_WRITE } from "@/lib/auth";
import { Flash } from "@/components/Flash";
import { Submit } from "@/components/Submit";
import { getAdminContext } from "../context";
import { createTreatment, updateTreatment } from "../actions";

export const metadata = { title: "Behandelingen" };

export default async function Treatments({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const { supabase, role } = await getAdminContext();
  const { data } = await supabase.from("treatments").select("*").order("sort");
  const ops = can(role, ADMIN_WRITE.ops);
  return (
    <>
      <div className="page-head"><div><h1>Behandelingen</h1><p>De standaard credits en tarieven. Per salon kun je afwijken op de salonpagina.</p></div></div>
      <Flash params={sp} />
      <div className="grid two">
        {(data ?? []).map((t: any) => (
          <form key={t.id} action={updateTreatment} className="card grid" style={{ opacity: t.active ? 1 : .6 }}>
            <input type="hidden" name="id" value={t.id} />
            <div className="card-head" style={{ marginBottom: 0 }}>
              <h3>{t.name}</h3>
              <span className="badge neutral">{Math.round((t.default_payout_cents / t.retail_price_cents) * 100)}% van prijs · €{(t.default_payout_cents / 100 / t.credits).toFixed(2).replace(".", ",")}/credit</span>
            </div>
            <fieldset disabled={!ops} style={{ border: 0, padding: 0, margin: 0 }} className="form-grid">
              <label className="field">Naam<input name="name" defaultValue={t.name} /></label>
              <label className="field">Credits<input name="credits" type="number" min="1" inputMode="numeric" defaultValue={t.credits} /></label>
              <label className="field">Normale prijs €<input name="retail" type="number" step="0.01" inputMode="decimal" defaultValue={(t.retail_price_cents / 100).toFixed(2)} /></label>
              <label className="field">Uitbetaling €<input name="payout" type="number" step="0.01" inputMode="decimal" defaultValue={(t.default_payout_cents / 100).toFixed(2)} /></label>
              <label className="field">Duur (min)<input name="duration" type="number" min="5" inputMode="numeric" defaultValue={t.duration_min} /></label>
              <label className="small" style={{ display: "flex", gap: 6, alignItems: "center", alignSelf: "center" }}><input type="checkbox" name="active" defaultChecked={t.active} />Actief</label>
            </fieldset>
            {ops && <div><Submit className="btn small">Opslaan</Submit></div>}
          </form>
        ))}
      </div>

      {ops && (
        <form action={createTreatment} className="card grid section">
          <h2>Nieuwe behandeling</h2>
          <div className="form-grid">
            <label className="field">Naam<input name="name" required /></label>
            <label className="field">Categorie<input name="category" placeholder="bijv. Gezicht" /></label>
            <label className="field">Credits<input name="credits" type="number" min="1" required /></label>
            <label className="field">Normale prijs €<input name="retail" type="number" step="0.01" required /></label>
            <label className="field">Uitbetaling €<input name="payout" type="number" step="0.01" required /></label>
            <label className="field">Duur (min)<input name="duration" type="number" defaultValue={45} /></label>
            <Submit>Toevoegen</Submit>
          </div>
        </form>
      )}
    </>
  );
}
