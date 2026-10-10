import { can, ADMIN_WRITE } from "@/lib/auth";
import { euro } from "@/lib/format";
import { Flash } from "@/components/Flash";
import { Submit } from "@/components/Submit";
import { getAdminContext } from "../context";
import { updatePlan } from "../actions";

export const metadata = { title: "Memberships" };

export default async function Plans({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const { supabase, role } = await getAdminContext();
  const [{ data: plans }, { data: treatments }] = await Promise.all([
    supabase.from("plans").select("*").order("sort"),
    supabase.from("treatments").select("credits, default_payout_cents").eq("active", true),
  ]);
  const ops = can(role, ADMIN_WRITE.ops);
  const t = treatments ?? [];
  // Average payout per credit (incl. VAT) across active treatments
  const perCredit = t.length ? t.reduce((a: number, x: any) => a + x.default_payout_cents / x.credits, 0) / t.length : 0;

  return (
    <>
      <div className="page-head"><div><h1>Memberships</h1><p>Prijzen, credits en hoeveel credits mee mogen naar de volgende maand.</p></div></div>
      <Flash params={sp} />
      <div className="grid three">
        {(plans ?? []).map((p: any) => {
          const revenueEx = p.monthly_price_cents / 1.21;
          const fullCostEx = (p.monthly_credits * perCredit) / 1.21;
          const margin = revenueEx - fullCostEx - 50;
          return (
            <form key={p.id} action={updatePlan} className="card grid">
              <input type="hidden" name="id" value={p.id} />
              <label className="field">Naam<input name="name" defaultValue={p.name} disabled={!ops} /></label>
              <label className="field">Ondertitel<input name="tagline" defaultValue={p.tagline} disabled={!ops} /></label>
              <label className="field">Prijs per maand €<input name="price" type="number" step="0.01" defaultValue={(p.monthly_price_cents / 100).toFixed(2)} disabled={!ops} /></label>
              <label className="field">Credits per maand<input name="credits" type="number" min="1" defaultValue={p.monthly_credits} disabled={!ops} /></label>
              <label className="field">Max. credits meenemen<input name="rollover" type="number" min="0" defaultValue={p.rollover_max} disabled={!ops} /></label>
              <label className="small" style={{ display: "flex", gap: 6, alignItems: "center" }}><input type="checkbox" name="active" defaultChecked={p.active} disabled={!ops} style={{ width: "auto" }} />Te koop</label>
              <div className="card" style={{ background: "var(--ivory)", padding: 14 }}>
                <div className="small muted">Marge bij 100% gebruik (excl. btw, schatting)</div>
                <b style={{ color: margin < 0 ? "var(--bad)" : "var(--ok)" }}>{euro(margin)}</b> <span className="small muted">per lid per maand</span>
              </div>
              {ops && <div><Submit>Opslaan</Submit></div>}
            </form>
          );
        })}
      </div>
      <p className="small muted" style={{ marginTop: 12 }}>Een prijswijziging geldt direct voor nieuwe aanvragen. Bestaande members houden hun membership, maar de nieuwe credits gelden vanaf hun volgende maand. Zie docs/prijsplan.md voor de onderbouwing.</p>
    </>
  );
}
