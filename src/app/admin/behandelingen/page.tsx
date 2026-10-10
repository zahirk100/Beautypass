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
      <div className="table-wrap">
        <table>
          <thead><tr><th>Behandeling</th><th>Credits</th><th>Normale prijs €</th><th>Uitbetaling €</th><th>Marge-indicatie</th><th>Duur</th><th>Actief</th><th></th></tr></thead>
          <tbody>
            {(data ?? []).map((t: any) => (
              <tr key={t.id}>
                <td colSpan={8} style={{ padding: 0 }}>
                  <form action={updateTreatment} className="inline-form" style={{ padding: "10px 14px" }}>
                    <input type="hidden" name="id" value={t.id} />
                    <input name="name" defaultValue={t.name} disabled={!ops} style={{ width: 170 }} />
                    <input name="credits" type="number" min="1" defaultValue={t.credits} disabled={!ops} />
                    <input name="retail" type="number" step="0.01" defaultValue={(t.retail_price_cents / 100).toFixed(2)} disabled={!ops} />
                    <input name="payout" type="number" step="0.01" defaultValue={(t.default_payout_cents / 100).toFixed(2)} disabled={!ops} />
                    <span className="small muted" style={{ width: 150 }}>{Math.round((t.default_payout_cents / t.retail_price_cents) * 100)}% van prijs · €{(t.default_payout_cents / 100 / t.credits).toFixed(2)}/credit</span>
                    <input name="duration" type="number" min="5" defaultValue={t.duration_min} disabled={!ops} />
                    <input type="checkbox" name="active" defaultChecked={t.active} disabled={!ops} style={{ width: "auto" }} />
                    {ops && <Submit className="btn small">Opslaan</Submit>}
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="small muted" style={{ marginTop: 10 }}>Volgorde van de velden: naam · credits · normale prijs · uitbetaling aan salon · indicatie · duur (min) · actief.</p>

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
