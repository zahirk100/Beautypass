import { can, ADMIN_WRITE } from "@/lib/auth";
import { roleLabel } from "@/lib/format";
import { Flash } from "@/components/Flash";
import { Submit } from "@/components/Submit";
import { getAdminContext } from "../context";
import { setAdminRole } from "../actions";

export const metadata = { title: "Team" };

const RIGHTS: [string, string][] = [
  ["super_admin", "Alles, inclusief teamleden en rollen beheren"],
  ["ops", "Salons, behandelingen, memberships, wachtlijst, lanceringen en leden activeren"],
  ["support", "Leden helpen: credits corrigeren, pauzeren, opzeggen en boekingen aanpassen"],
  ["finance", "Alles inzien: omzet, uitbetalingen en rapportages"],
];

export default async function Team({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const { supabase, role } = await getAdminContext();
  const { data } = await supabase.rpc("admin_team");
  const superAdmin = can(role, ADMIN_WRITE.super);
  return (
    <>
      <div className="page-head"><div><h1>Team</h1><p>Wie heeft toegang tot beheer, en met welke rechten.</p></div></div>
      <Flash params={sp} />
      <div className="grid two">
        <div className="card">
          <h2 style={{ marginBottom: 12 }}>Teamleden</h2>
          <div className="list">
            {(data ?? []).map((m: any) => (
              <div key={m.id} className="row-item" style={{ padding: "10px 14px" }}>
                <div className="grow"><b>{m.first_name} {m.last_name}</b><div className="small muted">{m.email}</div></div>
                <span className="badge">{roleLabel[m.admin_role]}</span>
              </div>
            ))}
          </div>
          {superAdmin && (
            <form action={setAdminRole} className="inline-form" style={{ marginTop: 16 }}>
              <input type="email" name="email" placeholder="E-mailadres van account" required />
              <select name="role" defaultValue="support">
                {RIGHTS.map(([r]) => <option key={r} value={r}>{roleLabel[r]}</option>)}
                <option value="none">Toegang intrekken</option>
              </select>
              <Submit className="btn small">Opslaan</Submit>
            </form>
          )}
          {!superAdmin && <p className="small muted" style={{ marginTop: 12 }}>Alleen een super-admin kan rollen wijzigen.</p>}
        </div>
        <div className="card">
          <h2 style={{ marginBottom: 12 }}>Rollen</h2>
          <div className="list">{RIGHTS.map(([r, d]) => <div key={r}><b>{roleLabel[r]}</b><div className="small muted">{d}</div></div>)}</div>
        </div>
      </div>
    </>
  );
}
