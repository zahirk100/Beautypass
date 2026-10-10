import Link from "next/link";
import { can, ADMIN_WRITE } from "@/lib/auth";
import { dateShort, time } from "@/lib/format";
import { channel, countBy } from "@/lib/sources";
import { Flash } from "@/components/Flash";
import { StatusBadge } from "@/components/Badge";
import { getAdminContext } from "../context";
import { setWaitlistStatus } from "../actions";

export const metadata = { title: "Wachtlijst" };
const STATUSES = ["waiting", "invited", "member", "unsubscribed"];

export default async function Waitlist({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const { supabase, role } = await getAdminContext();
  let query = supabase.from("waitlist").select("*").order("created_at", { ascending: false }).limit(1000);
  if (STATUSES.includes(sp.status)) query = query.eq("status", sp.status);
  const [{ data: rows }, { data: all }] = await Promise.all([query, supabase.from("waitlist").select("source, phone").limit(20000)]);
  const channels = countBy(all ?? [], (w: any) => channel(w.source));
  const withPhone = (all ?? []).filter((w: any) => w.phone).length;
  const canEdit = can(role, ADMIN_WRITE.ops);

  return (
    <>
      <div className="page-head">
        <div><h1>Wachtlijst</h1><p>{(all ?? []).length} aanmeldingen · {withPhone} met telefoonnummer voor sms</p></div>
        <a href="/admin/wachtlijst/export" className="btn secondary">Exporteer CSV</a>
      </div>
      <Flash params={sp} />
      <div className="chips" style={{ marginBottom: 16 }}>
        {channels.map(([name, n]) => <span key={name} className="chip">{name}: <b>{n}</b></span>)}
      </div>
      <div className="chips" style={{ marginBottom: 16 }}>
        <Link href="/admin/wachtlijst" className={`chip${!sp.status ? " on" : ""}`}>Alle</Link>
        {STATUSES.map((s) => <Link key={s} href={`/admin/wachtlijst?status=${s}`} className={`chip${sp.status === s ? " on" : ""}`}><StatusBadge status={s} /></Link>)}
      </div>
      <div className="table-wrap">
        <table className="rtable">
          <thead><tr><th>Naam</th><th>Aangemeld</th><th>Mobiel</th><th>Kanaal</th><th>Status</th></tr></thead>
          <tbody>
            {(rows ?? []).map((w: any) => (
              <tr key={w.id}>
                <td className="primary"><div><b>{w.name}</b><div className="small muted">{w.email}</div></div></td>
                <td data-label="Aangemeld">{dateShort(w.created_at)} {time(w.created_at)}</td>
                <td data-label="Mobiel">{w.phone ?? "–"}</td>
                <td data-label="Kanaal">{channel(w.source)}{w.campaign ? <span className="muted small"> · {w.campaign}</span> : null}</td>
                <td data-label="Status">
                  {canEdit ? (
                    <form action={setWaitlistStatus} className="inline-form">
                      <input type="hidden" name="id" value={w.id} />
                      <select name="status" defaultValue={w.status}>{STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select>
                      <button className="btn secondary small">Opslaan</button>
                    </form>
                  ) : <StatusBadge status={w.status} />}
                </td>
              </tr>
            ))}
            {(rows ?? []).length === 0 && <tr><td colSpan={5} className="empty">Geen aanmeldingen gevonden.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
