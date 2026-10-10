import Link from "next/link";
import { can, ADMIN_WRITE } from "@/lib/auth";
import { currentMonth, euro, monthLabel } from "@/lib/format";
import { channel, countBy } from "@/lib/sources";
import { Flash } from "@/components/Flash";
import { Submit } from "@/components/Submit";
import { getAdminContext } from "./context";
import { runRenewals } from "./actions";

export default async function AdminDashboard({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const { supabase, role } = await getAdminContext();
  const [{ data: eco }, { data: wl }, { data: salons }, { data: payouts }] = await Promise.all([
    supabase.rpc("admin_economics", { p_month: currentMonth() }),
    supabase.from("waitlist").select("source, status, created_at").limit(20000),
    supabase.from("salons").select("status"),
    supabase.rpc("salon_payouts", { p_month: currentMonth() }),
  ]);
  const e: any = (eco ?? [])[0] ?? {};
  const revenueEx = (e.mrr_cents ?? 0) / 1.21;
  const costEx = (e.payout_cents ?? 0) / 1.21;
  const usage = e.credits_granted ? Math.round((e.credits_used / e.credits_granted) * 100) : 0;
  const waitlist = wl ?? [];
  const week = waitlist.filter((w: any) => Date.now() - new Date(w.created_at).getTime() < 7 * 864e5).length;
  const channels = countBy(waitlist, (w: any) => channel(w.source)).slice(0, 6);
  const activeSalons = (salons ?? []).filter((s: any) => s.status === "active").length;
  const leadSalons = (salons ?? []).filter((s: any) => s.status === "lead").length;
  const topSalons = (payouts ?? []).filter((p: any) => p.bookings > 0).sort((a: any, b: any) => b.payout_cents - a.payout_cents).slice(0, 5);

  return (
    <>
      <div className="page-head">
        <div><h1>Dashboard</h1><p className="cap">{monthLabel(new Date())}</p></div>
        {can(role, ADMIN_WRITE.ops) && (
          <form action={runRenewals}><Submit className="btn secondary" confirm="Alle memberships waarvan de maand om is krijgen nu nieuwe credits. Doorgaan?">Maandovergang uitvoeren</Submit></form>
        )}
      </div>
      <Flash params={sp} />

      <div className="grid stats">
        <div className="card dark stat"><div className="label">Actieve members</div><div className="value">{e.active_members ?? 0}</div><div className="sub" style={{ color: "rgba(251,247,242,.7)" }}>{e.pending_members ?? 0} aanvragen wachten</div></div>
        <div className="card stat"><div className="label">Maandomzet (MRR)</div><div className="value">{euro(e.mrr_cents)}</div><div className="sub">{euro(revenueEx)} excl. btw</div></div>
        <div className="card stat"><div className="label">Uitbetaling salons</div><div className="value">{euro(e.payout_cents)}</div><div className="sub">deze maand, incl. btw</div></div>
        <div className="card stat"><div className="label">Brutomarge (schatting)</div><div className="value">{euro(revenueEx - costEx)}</div><div className="sub">{revenueEx ? Math.round(((revenueEx - costEx) / revenueEx) * 100) : 0}% · excl. btw, vóór vaste kosten</div></div>
      </div>

      <div className="grid two section">
        <div className="card">
          <div className="card-head"><h2>Gebruik van credits</h2><span className="badge">{usage}%</span></div>
          <div className="bar"><i style={{ width: `${Math.min(usage, 100)}%` }} /></div>
          <p className="small muted" style={{ marginTop: 10 }}>{e.credits_used ?? 0} van {e.credits_granted ?? 0} toegekende credits deze maand geboekt. Hoe lager, hoe hoger de marge, maar te laag betekent later opzeggingen.</p>
          <div className="grid stats" style={{ marginTop: 16 }}>
            <div className="stat"><div className="label">Voltooid</div><div className="value">{e.bookings_completed ?? 0}</div></div>
            <div className="stat"><div className="label">Gepland</div><div className="value">{e.bookings_booked ?? 0}</div></div>
            <div className="stat"><div className="label">No-shows</div><div className="value">{e.no_shows ?? 0}</div></div>
          </div>
        </div>
        <div className="card">
          <div className="card-head"><h2>Wachtlijst</h2><Link href="/admin/wachtlijst" className="small">Bekijk →</Link></div>
          <div className="grid stats">
            <div className="stat"><div className="label">Totaal</div><div className="value">{waitlist.length}</div></div>
            <div className="stat"><div className="label">Laatste 7 dagen</div><div className="value">+{week}</div></div>
          </div>
          <div className="list" style={{ marginTop: 14 }}>
            {channels.map(([name, n]) => (
              <div key={name}>
                <div className="small" style={{ display: "flex", justifyContent: "space-between" }}><span>{name}</span><b>{n}</b></div>
                <div className="bar"><i style={{ width: `${(n / Math.max(waitlist.length, 1)) * 100}%` }} /></div>
              </div>
            ))}
            {channels.length === 0 && <p className="muted small">Nog geen aanmeldingen.</p>}
          </div>
        </div>
      </div>

      <div className="grid two section">
        <div className="card">
          <div className="card-head"><h2>Salonnetwerk</h2><Link href="/admin/salons" className="small">Bekijk →</Link></div>
          <div className="grid stats">
            <div className="stat"><div className="label">Live</div><div className="value">{activeSalons}</div></div>
            <div className="stat"><div className="label">In gesprek</div><div className="value">{leadSalons}</div></div>
          </div>
          <p className="small muted" style={{ marginTop: 10 }}>Streefdoel voor de lancering: 10–15 live salons verspreid over de stad.</p>
        </div>
        <div className="card">
          <h2 style={{ marginBottom: 12 }}>Top salons deze maand</h2>
          {topSalons.length === 0 ? <p className="muted small">Nog geen uitbetaalbare afspraken.</p> : (
            <div className="list">
              {topSalons.map((p: any) => <div key={p.salon_id} className="small" style={{ display: "flex", justifyContent: "space-between" }}><span>{p.salon_name}</span><span>{p.bookings} · <b>{euro(p.payout_cents)}</b></span></div>)}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
