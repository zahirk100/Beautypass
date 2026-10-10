import Link from "next/link";
import { notFound } from "next/navigation";
import { can, ADMIN_WRITE } from "@/lib/auth";
import { dateShort, time } from "@/lib/format";
import { Flash } from "@/components/Flash";
import { Submit } from "@/components/Submit";
import { StatusBadge } from "@/components/Badge";
import { getAdminContext } from "../../context";
import { activateMembership, adjustCredits, setMembershipStatus } from "../../actions";

const reasonLabel: Record<string, string> = {
  monthly_grant: "Maandtegoed", booking: "Boeking", refund: "Teruggeboekt", expiry: "Vervallen", adjustment: "Correctie",
};

export default async function MemberDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, role } = await getAdminContext();
  const [{ data: members }, { data: ledger }, { data: bookings }] = await Promise.all([
    supabase.rpc("admin_members"),
    supabase.from("credit_ledger").select("delta, reason, note, created_at").eq("user_id", id).order("created_at", { ascending: false }).limit(50),
    supabase.from("bookings").select("id, starts_at, status, credits, note, salons(name), treatments(name)").eq("user_id", id).order("starts_at", { ascending: false }).limit(50),
  ]);
  const m = (members ?? []).find((x: any) => x.user_id === id);
  if (!m) notFound();
  const back = `/admin/leden/${id}`;
  const ops = can(role, ADMIN_WRITE.ops);
  const support = can(role, ADMIN_WRITE.support);
  const done = (bookings ?? []).filter((b: any) => b.status === "completed").length;
  const noShows = (bookings ?? []).filter((b: any) => b.status === "no_show").length;

  return (
    <>
      <Link href="/admin/leden" className="small muted">← Alle leden</Link>
      <div className="page-head" style={{ marginTop: 10 }}>
        <div><h1>{m.first_name} {m.last_name}</h1><p>{m.email}{m.phone ? ` · ${m.phone}` : ""}</p></div>
        <StatusBadge status={m.status} />
      </div>
      <Flash params={sp} />

      <div className="grid stats">
        <div className="card dark stat"><div className="label">Tegoed</div><div className="value">{m.balance}</div><div className="sub" style={{ color: "rgba(251,247,242,.7)" }}>credits</div></div>
        <div className="card stat"><div className="label">Membership</div><div className="value" style={{ fontSize: "1.4rem" }}>{m.plan_name ?? "–"}</div><div className="sub">{m.founding_number ? `Founding Nº ${String(m.founding_number).padStart(3, "0")}` : " "}</div></div>
        <div className="card stat"><div className="label">Afspraken</div><div className="value">{done}</div><div className="sub">voltooid · {noShows} no-show</div></div>
        <div className="card stat"><div className="label">Volgende maand</div><div className="value" style={{ fontSize: "1.4rem" }}>{m.current_period_end ? dateShort(m.current_period_end) : "–"}</div></div>
      </div>

      {m.membership_id && (support || ops) && (
        <div className="card section grid">
          <h2>Acties</h2>
          <div className="inline-form">
            {ops && (m.status === "pending" || m.status === "paused") && (
              <form action={activateMembership} className="inline-form">
                <input type="hidden" name="membership" value={m.membership_id} /><input type="hidden" name="back" value={back} />
                {m.status === "pending" && <label className="small" style={{ display: "flex", gap: 4, alignItems: "center" }}><input type="checkbox" name="founding" defaultChecked />Founding</label>}
                <Submit className="btn small" confirm={m.status === "pending" ? "Membership activeren en de eerste credits toekennen? Doe dit pas na de eerste betaling." : "Membership weer activeren?"}>Activeer</Submit>
              </form>
            )}
            {support && m.status === "active" && (
              <form action={setMembershipStatus}><input type="hidden" name="membership" value={m.membership_id} /><input type="hidden" name="status" value="paused" /><input type="hidden" name="back" value={back} /><Submit className="btn secondary small">Pauzeer</Submit></form>
            )}
            {support && m.status !== "cancelled" && (
              <form action={setMembershipStatus}><input type="hidden" name="membership" value={m.membership_id} /><input type="hidden" name="status" value="cancelled" /><input type="hidden" name="back" value={back} /><Submit className="btn danger small" confirm="Membership opzeggen?">Opzeggen</Submit></form>
            )}
          </div>
          {support && (
            <form action={adjustCredits} className="form-grid">
              <input type="hidden" name="user" value={id} /><input type="hidden" name="back" value={back} />
              <label className="field">Credits (+/-)<input type="number" name="delta" inputMode="numeric" required /></label>
              <label className="field">Reden<input name="note" required placeholder="Bijv. excuus voor wachttijd" /></label>
              <Submit className="btn secondary">Credits aanpassen</Submit>
            </form>
          )}
        </div>
      )}

      <div className="grid two section" style={{ alignItems: "start" }}>
        <section>
          <h2 style={{ marginBottom: 12 }}>Afspraken</h2>
          <div className="table-wrap">
            <table className="rtable">
              <thead><tr><th>Wanneer</th><th>Salon</th><th>Behandeling</th><th>Status</th></tr></thead>
              <tbody>
                {(bookings ?? []).map((b: any) => (
                  <tr key={b.id}>
                    <td className="primary">{dateShort(b.starts_at)} {time(b.starts_at)}</td>
                    <td data-label="Salon">{b.salons?.name}</td>
                    <td data-label="Behandeling"><span>{b.treatments?.name} · {b.credits}{b.note && <><br /><span className="note">“{b.note}”</span></>}</span></td>
                    <td data-label="Status"><StatusBadge status={b.status} /></td>
                  </tr>
                ))}
                {(bookings ?? []).length === 0 && <tr><td colSpan={4} className="empty">Nog geen afspraken.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
        <section>
          <h2 style={{ marginBottom: 12 }}>Credits</h2>
          <div className="table-wrap">
            <table className="rtable">
              <thead><tr><th>Datum</th><th>Soort</th><th>Credits</th></tr></thead>
              <tbody>
                {(ledger ?? []).map((l: any, i: number) => (
                  <tr key={i}>
                    <td className="primary">{dateShort(l.created_at)}</td>
                    <td data-label="Soort"><span>{reasonLabel[l.reason] ?? l.reason}{l.note && <div className="small muted">{l.note}</div>}</span></td>
                    <td data-label="Credits"><b style={{ color: l.delta > 0 ? "var(--ok)" : "var(--ink)" }}>{l.delta > 0 ? `+${l.delta}` : l.delta}</b></td>
                  </tr>
                ))}
                {(ledger ?? []).length === 0 && <tr><td colSpan={3} className="empty">Nog geen mutaties.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}
