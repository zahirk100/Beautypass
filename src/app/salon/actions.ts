"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { back, errorMessage, int, str } from "@/lib/actions";
import { amsterdamToUtc } from "@/lib/format";
import { SALON_COOKIE, getSalonContext } from "./context";

export async function switchSalon(fd: FormData) {
  (await cookies()).set(SALON_COOKIE, str(fd, "salon"), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
  redirect("/salon");
}

/** Creates a series of slots: from–to on a day, every N minutes, optionally repeated weekly. */
export async function addSlots(fd: FormData) {
  const { supabase, salonId, user } = await getSalonContext();
  const date = str(fd, "date");
  const from = str(fd, "from");
  const to = str(fd, "to") || from;
  const duration = int(fd, "duration") || 60;
  const weeks = Math.min(Math.max(int(fd, "weeks") || 1, 1), 8);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(from) || !/^\d{2}:\d{2}$/.test(to)) {
    back("/salon/agenda", "error", "Vul een geldige datum en tijden in.");
  }
  if (duration < 15 || duration > 240) back("/salon/agenda", "error", "Kies een duur tussen 15 en 240 minuten.");

  const rows: { salon_id: string; starts_at: string; ends_at: string; created_by: string }[] = [];
  for (let w = 0; w < weeks; w++) {
    const start = amsterdamToUtc(date, from).getTime() + w * 7 * 864e5;
    const end = Math.max(amsterdamToUtc(date, to).getTime() + w * 7 * 864e5, start + duration * 6e4);
    for (let t = start; t + duration * 6e4 <= end; t += duration * 6e4) {
      rows.push({ salon_id: salonId, starts_at: new Date(t).toISOString(), ends_at: new Date(t + duration * 6e4).toISOString(), created_by: user.id });
    }
  }
  const future = rows.filter((r) => new Date(r.starts_at).getTime() > Date.now());
  if (future.length === 0) back("/salon/agenda", "error", "Deze tijden liggen in het verleden.");
  if (future.length > 200) back("/salon/agenda", "error", "Maximaal 200 tijden tegelijk.");
  const { error } = await supabase.from("slots").insert(future);
  if (error) back("/salon/agenda", "error", errorMessage(error));
  revalidatePath("/salon", "layout");
  back("/salon/agenda", "ok", `${future.length} ${future.length === 1 ? "tijd" : "tijden"} toegevoegd.`);
}

export async function deleteSlot(fd: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from("slots").delete().eq("id", str(fd, "slot")).neq("status", "booked");
  if (error) back("/salon/agenda", "error", errorMessage(error));
  revalidatePath("/salon/agenda");
  back("/salon/agenda", "ok", "Tijd verwijderd.");
}

export async function setBookingStatus(fd: FormData) {
  const supabase = await createClient();
  const requested = str(fd, "back");
  const to = requested.startsWith("/salon") ? requested : "/salon";
  const { error } = await supabase.rpc("salon_set_booking_status", { p_booking: str(fd, "booking"), p_status: str(fd, "status") });
  if (error) back(to, "error", errorMessage(error));
  revalidatePath("/salon", "layout");
  back(to, "ok", "Afspraak bijgewerkt.");
}

export async function updateSalonProfile(fd: FormData) {
  const { supabase, salonId } = await getSalonContext();
  const { error } = await supabase.rpc("update_salon_profile", {
    p_salon: salonId, p_description: str(fd, "description"), p_address: str(fd, "address"), p_district: str(fd, "district"),
  });
  if (error) back("/salon/instellingen", "error", errorMessage(error));
  back("/salon/instellingen", "ok", "Salonprofiel opgeslagen.");
}

export async function addStaff(fd: FormData) {
  const { supabase, salonId } = await getSalonContext();
  const { error } = await supabase.rpc("add_salon_member", { p_salon: salonId, p_email: str(fd, "email"), p_role: "staff" });
  if (error) back("/salon/instellingen", "error", errorMessage(error));
  revalidatePath("/salon/instellingen");
  back("/salon/instellingen", "ok", "Medewerker toegevoegd.");
}

export async function removeStaff(fd: FormData) {
  const { supabase, salonId } = await getSalonContext();
  const { error } = await supabase.from("salon_members").delete().eq("salon_id", salonId).eq("user_id", str(fd, "user")).eq("role", "staff");
  if (error) back("/salon/instellingen", "error", errorMessage(error));
  revalidatePath("/salon/instellingen");
  back("/salon/instellingen", "ok", "Medewerker verwijderd.");
}
