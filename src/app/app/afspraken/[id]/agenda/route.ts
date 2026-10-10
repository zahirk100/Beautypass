import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const esc = (s: string) => s.replace(/[\;,]/g, (m) => `\\${m}`).replace(/\n/g, "\\n");

// "Zet in agenda": an .ics file for one of the member's own bookings
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: b } = await supabase.from("bookings")
    .select("id, starts_at, note, salons(name, address, postcode, latitude, longitude), treatments(name, duration_min)")
    .eq("id", id).maybeSingle();
  if (!b) return new NextResponse("Niet gevonden", { status: 404 });
  const salon: any = b.salons;
  const treatment: any = b.treatments;
  const start = new Date(b.starts_at);
  const end = new Date(start.getTime() + (treatment?.duration_min ?? 60) * 60000);
  const location = [salon?.address, salon?.postcode, "Amsterdam"].filter(Boolean).join(", ");
  const ics = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//BeautyPass//NL", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${b.id}@beautypass`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(`${treatment?.name ?? "Afspraak"} · ${salon?.name ?? "BeautyPass"}`)}`,
    `LOCATION:${esc(location)}`,
    `DESCRIPTION:${esc(`Geboekt via BeautyPass. Gratis annuleren tot 24 uur vooraf.${b.note ? `\nOpmerking: ${b.note}` : ""}`)}`,
    ...(salon?.latitude != null ? [`GEO:${salon.latitude};${salon.longitude}`] : []),
    "BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:Je beauty-afspraak", "TRIGGER:-PT2H", "END:VALARM",
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
  return new NextResponse(ics, {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `inline; filename="beautypass-afspraak.ics"` },
  });
}
