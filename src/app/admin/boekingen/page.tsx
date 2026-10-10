import { can, ADMIN_WRITE } from "@/lib/auth";
import { dateShort, time } from "@/lib/format";
import { Flash } from "@/components/Flash";
import { Submit } from "@/components/Submit";
import { StatusBadge } from "@/components/Badge";
import { getAdminContext } from "../context";
import { adminSetBookingStatus } from "../actions";

export const metadata = { title: "Boekingen" };

export default async function Bookings({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const { supabase, role } = await getAdminContext();
  const { data } = await supabase.from("bookings")
    .select("id, starts_at, status, credits, payout_cents, salons(name), treatments(name), user_id")
    .order("starts_at", { ascending: false }).limit(300);
  const support = can(role, ADMIN_WRITE.support);
  return (
    <>
      <div className="page-head"><div><h1>Boekingen</h1><p>De laatste 300 boekingen over alle salons.</p></div></div>
      <Flash params={sp} />
      <div className="table-wrap">
        <table>
          <thead><tr><th>Wanneer</th><th>Salon</th><th>Behandeling</th><th>Credits</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {(data ?? []).map((b: any) => (
              <tr key={b.id}>
                <td>{dateShort(b.starts_at)} {time(b.starts_at)}</td>
                <td>{b.salons?.name}</td>
                <td>{b.treatments?.name}</td>
                <td>{b.credits}</td>
                <td><StatusBadge status={b.status} /></td>
                <td>
                  {support && b.status === "booked" && (
                    <form action={adminSetBookingStatus} className="inline-form">
                      <input type="hidden" name="booking" value={b.id} />
                      <select name="status" defaultValue="cancelled_by_salon">
                        <option value="cancelled_by_salon">Annuleren (credits terug)</option>
                        <option value="completed">Voltooid</option>
                        <option value="no_show">No-show</option>
                      </select>
                      <Submit className="btn secondary small" confirm="Status van deze boeking wijzigen?">Wijzig</Submit>
                    </form>
                  )}
                </td>
              </tr>
            ))}
            {(data ?? []).length === 0 && <tr><td colSpan={6} className="empty">Nog geen boekingen.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
