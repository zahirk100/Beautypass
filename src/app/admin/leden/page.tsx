import Link from "next/link";
import { can, ADMIN_WRITE } from "@/lib/auth";
import { dateShort } from "@/lib/format";
import { Flash } from "@/components/Flash";
import { Submit } from "@/components/Submit";
import { StatusBadge } from "@/components/Badge";
import { getAdminContext } from "../context";
import { activateMembership, adjustCredits, setMembershipStatus } from "../actions";

export const metadata = { title: "Leden" };
const FILTERS = [["", "Alle"], ["pending", "Aanvragen"], ["active", "Actief"], ["paused", "Gepauzeerd"], ["cancelled", "Opgezegd"], ["none", "Zonder membership"]];

export default async function Members({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const { supabase, role } = await getAdminContext();
  const { data } = await supabase.rpc("admin_members");
  const q = (sp.q ?? "").toLowerCase();
  const rows = (data ?? []).filter((m: any) =>
    (!sp.f || (sp.f === "none" ? !m.status : m.status === sp.f)) &&
    (!q || `${m.first_name} ${m.last_name} ${m.email}`.toLowerCase().includes(q)));
  const pending = (data ?? []).filter((m: any) => m.status === "pending").length;
  const isOps = can(role, ADMIN_WRITE.ops);
  const isSupport = can(role, ADMIN_WRITE.support);

  return (
    <>
      <div className="page-head">
        <div><h1>Leden</h1><p>{(data ?? []).filter((m: any) => m.status === "active").length} actief · {pending} aanvragen wachten op activatie</p></div>
        <form className="inline-form"><input name="q" placeholder="Zoek op naam of e-mail" defaultValue={sp.q ?? ""} />{sp.f && <input type="hidden" name="f" value={sp.f} />}<button className="btn secondary small">Zoek</button></form>
      </div>
      <Flash params={sp} />
      <div className="chips" style={{ marginBottom: 16 }}>
        {FILTERS.map(([v, l]) => <Link key={v} href={v ? `/admin/leden?f=${v}` : "/admin/leden"} className={`chip${(sp.f ?? "") === v ? " on" : ""}`}>{l}</Link>)}
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Lid</th><th>Membership</th><th>Status</th><th>Credits</th><th>Volgende maand</th><th>Acties</th></tr></thead>
          <tbody>
            {rows.map((m: any) => (
              <tr key={m.user_id}>
                <td><b>{m.first_name} {m.last_name}</b><div className="small muted">{m.email}{m.phone ? ` · ${m.phone}` : ""}</div></td>
                <td>{m.plan_name ?? "–"}{m.founding_number ? <div className="small muted">Founding Nº {String(m.founding_number).padStart(3, "0")}</div> : null}</td>
                <td><StatusBadge status={m.status} /></td>
                <td><b>{m.balance}</b></td>
                <td>{m.current_period_end ? dateShort(m.current_period_end) : "–"}</td>
                <td>
                  <div className="inline-form">
                    {isOps && (m.status === "pending" || m.status === "paused") && (
                      <form action={activateMembership} className="inline-form">
                        <input type="hidden" name="membership" value={m.membership_id} />
                        {m.status === "pending" && <label className="small" style={{ display: "flex", gap: 4, alignItems: "center" }}><input type="checkbox" name="founding" defaultChecked style={{ width: "auto" }} />Founding</label>}
                        <Submit className="btn small" confirm={m.status === "pending" ? "Membership activeren en de eerste credits toekennen? Doe dit pas na de eerste betaling." : "Membership weer activeren?"}>Activeer</Submit>
                      </form>
                    )}
                    {isSupport && m.status === "active" && (
                      <form action={setMembershipStatus}><input type="hidden" name="membership" value={m.membership_id} /><input type="hidden" name="status" value="paused" /><Submit className="btn secondary small">Pauzeer</Submit></form>
                    )}
                    {isSupport && m.membership_id && m.status !== "cancelled" && (
                      <form action={setMembershipStatus}><input type="hidden" name="membership" value={m.membership_id} /><input type="hidden" name="status" value="cancelled" /><Submit className="btn danger small" confirm="Membership opzeggen?">Opzeggen</Submit></form>
                    )}
                    {isSupport && (
                      <details className="more">
                        <summary>Credits</summary>
                        <form action={adjustCredits} className="inline-form">
                          <input type="hidden" name="user" value={m.user_id} />
                          <input type="number" name="delta" placeholder="+/-" required />
                          <input name="note" placeholder="Reden" required style={{ minWidth: 160 }} />
                          <Submit className="btn small">Opslaan</Submit>
                        </form>
                      </details>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="empty">Geen leden gevonden.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="small muted" style={{ marginTop: 12 }}>
        Activeren kent direct het eerste maandtegoed toe en geeft (indien aangevinkt) een founding-nummer 001–100. Zolang de automatische betaling nog niet is gekoppeld, activeer je pas na de eerste betaling.
      </p>
    </>
  );
}
