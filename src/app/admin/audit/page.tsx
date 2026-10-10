import { dateShort, time } from "@/lib/format";
import { getAdminContext } from "../context";

export const metadata = { title: "Logboek" };

export default async function Audit() {
  const { supabase } = await getAdminContext();
  const { data } = await supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(200);
  return (
    <>
      <div className="page-head"><div><h1>Logboek</h1><p>Elke belangrijke handeling in beheer en salonportaal wordt hier vastgelegd.</p></div></div>
      <div className="table-wrap">
        <table className="rtable">
          <thead><tr><th>Wanneer</th><th>Actie</th><th>Onderdeel</th><th>Details</th></tr></thead>
          <tbody>
            {(data ?? []).map((a: any) => (
              <tr key={a.id}><td className="primary">{dateShort(a.created_at)} {time(a.created_at)}</td><td data-label="Actie">{a.action}</td><td data-label="Onderdeel" className="small">{a.entity} <span className="muted">{a.entity_id?.slice(0, 8)}</span></td><td data-label="Details" className="small muted">{JSON.stringify(a.details)}</td></tr>
            ))}
            {(data ?? []).length === 0 && <tr><td colSpan={4} className="empty">Nog geen handelingen.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
