import { euro, monthLabel, dateShort, time } from "@/lib/format";
import { StatusBadge } from "@/components/Badge";
import { getSalonContext } from "../context";

export const metadata = { title: "Uitbetalingen" };

export default async function Payouts() {
  const { supabase, salonId } = await getSalonContext();
  const now = new Date();
  const months = [0, 1, 2, 3, 4, 5].map((i) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1)));
  const results = await Promise.all(months.map((m) => supabase.rpc("salon_payouts", { p_month: m.toISOString().slice(0, 10) })));
  const rows = months.map((m, i) => ({ month: m, data: (results[i].data ?? []).find((p: any) => p.salon_id === salonId) }));
  const monthStart = months[0];
  const { data: bookings } = await supabase.rpc("salon_bookings", { p_salon: salonId, p_from: monthStart.toISOString(), p_to: now.toISOString() });
  const paid = (bookings ?? []).filter((b: any) => ["completed", "no_show", "cancelled_late"].includes(b.status));

  return (
    <>
      <div className="page-head"><div><h1>Uitbetalingen</h1><p>Je ontvangt per maand de afgesproken prijs voor voltooide afspraken, no-shows en te late annuleringen.</p></div></div>
      <div className="table-wrap">
        <table className="rtable">
          <thead><tr><th>Maand</th><th>Afspraken</th><th>Bedrag (incl. btw)</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.month.toISOString()}><td className="cap primary">{monthLabel(r.month)}</td><td data-label="Afspraken">{r.data?.bookings ?? 0}</td><td data-label="Bedrag"><b>{euro(r.data?.payout_cents ?? 0)}</b></td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <section className="section">
        <h2>Deze maand</h2>
        {paid.length === 0 ? <div className="card empty">Nog geen uitbetaalbare afspraken deze maand.</div> : (
          <div className="table-wrap">
            <table className="rtable">
              <thead><tr><th>Datum</th><th>Member</th><th>Behandeling</th><th>Status</th><th>Bedrag</th></tr></thead>
              <tbody>{paid.map((b: any) => <tr key={b.id}><td className="primary">{dateShort(b.starts_at)} {time(b.starts_at)}</td><td data-label="Member">{b.member_name}</td><td data-label="Behandeling">{b.treatment}</td><td data-label="Status"><StatusBadge status={b.status} /></td><td data-label="Bedrag">{euro(b.payout_cents)}</td></tr>)}</tbody>
            </table>
          </div>
        )}
        <p className="small muted" style={{ marginTop: 10 }}>Facturen worden aan het eind van de maand door BeautyPass opgesteld (self-billing).</p>
      </section>
    </>
  );
}
