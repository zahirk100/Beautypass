import Link from "next/link";
import { can, ADMIN_WRITE } from "@/lib/auth";
import { Flash } from "@/components/Flash";
import { Submit } from "@/components/Submit";
import { StatusBadge } from "@/components/Badge";
import { getAdminContext } from "../context";
import { createSalon } from "../actions";

export const metadata = { title: "Salons" };

export default async function Salons({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const { supabase, role } = await getAdminContext();
  const [{ data: salons }, { data: offers }, { data: reviews }] = await Promise.all([
    supabase.from("salons").select("*").order("status").order("name"),
    supabase.from("salon_treatments").select("salon_id").eq("active", true),
    supabase.from("reviews").select("salon_id, rating"),
  ]);
  const count = (id: string) => (offers ?? []).filter((o: any) => o.salon_id === id).length;
  const rating = (id: string) => {
    const r = (reviews ?? []).filter((x: any) => x.salon_id === id).map((x: any) => x.rating);
    return r.length ? `${(r.reduce((a: number, b: number) => a + b, 0) / r.length).toFixed(1)} (${r.length})` : "–";
  };
  const groups = [["active", "Live"], ["lead", "In gesprek (pipeline)"], ["paused", "Gepauzeerd"]] as const;

  return (
    <>
      <div className="page-head"><div><h1>Salons</h1><p>Van eerste gesprek tot live salon: houd hier het hele netwerk bij.</p></div></div>
      <Flash params={sp} />
      {can(role, ADMIN_WRITE.ops) && (
        <form action={createSalon} className="card grid" style={{ marginBottom: 24 }}>
          <h2>Nieuwe salon</h2>
          <div className="form-grid">
            <label className="field">Naam<input name="name" required /></label>
            <label className="field">Wijk<input name="district" placeholder="bijv. De Pijp" /></label>
            <label className="field">Postcode<input name="postcode" placeholder="1072 LN" /></label>
            <label className="field">Contactpersoon<input name="contact_name" /></label>
            <label className="field">E-mail<input type="email" name="contact_email" /></label>
            <label className="field">Telefoon<input name="contact_phone" /></label>
            <Submit>Toevoegen als lead</Submit>
          </div>
        </form>
      )}
      {groups.map(([status, label]) => {
        const list = (salons ?? []).filter((s: any) => s.status === status);
        return (
          <section key={status} className="section">
            <h2>{label} <span className="muted small">({list.length})</span></h2>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Salon</th><th>Wijk</th><th>Contact</th><th>Behandelingen</th><th>Beoordeling</th><th>Status</th></tr></thead>
                <tbody>
                  {list.map((s: any) => (
                    <tr key={s.id}>
                      <td><Link href={`/admin/salons/${s.id}`}><b>{s.name}</b></Link></td>
                      <td>{s.district || "–"}{s.latitude == null && s.status !== "lead" ? <div className="small" style={{ color: "var(--bad)" }}>Geen locatie</div> : null}</td>
                      <td className="small">{s.contact_name}<div className="muted">{s.contact_email} {s.contact_phone}</div></td>
                      <td>{count(s.id)}</td>
                      <td>{rating(s.id)}</td>
                      <td><StatusBadge status={s.status} /></td>
                    </tr>
                  ))}
                  {list.length === 0 && <tr><td colSpan={6} className="empty">Geen salons.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </>
  );
}
