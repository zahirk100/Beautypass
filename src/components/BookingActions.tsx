import { Submit } from "@/components/Submit";
import { setBookingStatus } from "@/app/salon/actions";

/** Salon-side buttons for a booking: done, no-show, cancel. */
export function BookingActions({ id, status, startsAt, backTo }: { id: string; status: string; startsAt: string; backTo: string }) {
  if (status !== "booked") return null;
  const started = new Date(startsAt).getTime() - Date.now() <= 30 * 60 * 1000;
  const form = (s: string, label: string, cls: string, confirm?: string) => (
    <form action={setBookingStatus}>
      <input type="hidden" name="booking" value={id} />
      <input type="hidden" name="status" value={s} />
      <input type="hidden" name="back" value={backTo} />
      <Submit className={cls} confirm={confirm}>{label}</Submit>
    </form>
  );
  return (
    <div className="inline-form">
      {started && form("completed", "Voltooid", "btn small")}
      {started && form("no_show", "No-show", "btn secondary small", "Het lid is niet gekomen? De credits worden niet teruggegeven.")}
      {!started && form("cancelled_by_salon", "Annuleren", "btn danger small", "Afspraak annuleren? Het lid krijgt de credits terug en ontvangt geen uitbetaling.")}
    </div>
  );
}
