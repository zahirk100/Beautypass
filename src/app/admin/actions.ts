"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { back, cents, errorMessage, int, str } from "@/lib/actions";
import { geocodePostcode } from "@/lib/geo";

async function rpc(path: string, fn: string, args: Record<string, unknown>, ok: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc(fn, args);
  if (error) back(path, "error", errorMessage(error));
  revalidatePath("/admin", "layout");
  back(path, "ok", ok);
}

export async function runRenewals() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("run_monthly_renewals");
  if (error) back("/admin", "error", errorMessage(error));
  revalidatePath("/admin", "layout");
  back("/admin", "ok", `${data ?? 0} memberships verlengd met nieuwe credits.`);
}

const memberBack = (fd: FormData) => (str(fd, "back").startsWith("/admin/leden") ? str(fd, "back") : "/admin/leden");

export async function activateMembership(fd: FormData) {
  await rpc(memberBack(fd), "admin_activate_membership", { p_membership: str(fd, "membership"), p_founding: fd.get("founding") === "on" }, "Membership geactiveerd en credits toegekend.");
}

export async function setMembershipStatus(fd: FormData) {
  await rpc(memberBack(fd), "admin_set_membership_status", { p_membership: str(fd, "membership"), p_status: str(fd, "status") }, "Status bijgewerkt.");
}

export async function adjustCredits(fd: FormData) {
  await rpc(memberBack(fd), "admin_adjust_credits", { p_user: str(fd, "user"), p_delta: int(fd, "delta"), p_note: str(fd, "note") }, "Credits aangepast.");
}

export async function setWaitlistStatus(fd: FormData) {
  const supabase = await createClient();
  const to = str(fd, "back").startsWith("/admin/wachtlijst") ? str(fd, "back") : "/admin/wachtlijst";
  const { data, error } = await supabase.from("waitlist").update({ status: str(fd, "status") }).eq("id", str(fd, "id")).select("id");
  if (error) back(to, "error", errorMessage(error));
  if (!data?.length) back(to, "error", "Dit kon niet worden opgeslagen: je hebt hier geen rechten voor of het bestaat niet meer.");
  revalidatePath("/admin/wachtlijst");
  back(to, "ok", "Status bijgewerkt.");
}

export async function createSalon(fd: FormData) {
  const supabase = await createClient();
  const geo = str(fd, "postcode") ? await geocodePostcode(str(fd, "postcode")) : null;
  if (str(fd, "postcode") && !geo) back("/admin/salons", "error", "Deze postcode herkennen we niet.");
  const { data, error } = await supabase.from("salons").insert({
    name: str(fd, "name"), district: str(fd, "district"), contact_name: str(fd, "contact_name"),
    postcode: geo?.postcode ?? "", latitude: geo?.lat ?? null, longitude: geo?.lng ?? null,
    contact_email: str(fd, "contact_email"), contact_phone: str(fd, "contact_phone"), status: "lead",
  }).select("id").single();
  if (error) back("/admin/salons", "error", errorMessage(error));
  revalidatePath("/admin/salons");
  redirect(`/admin/salons/${data!.id}?ok=${encodeURIComponent("Salon aangemaakt. Stel nu de behandelingen in.")}`);
}

export async function updateSalon(fd: FormData) {
  const supabase = await createClient();
  const id = str(fd, "id");
  const location: Record<string, unknown> = {};
  if (str(fd, "postcode") && str(fd, "postcode") !== str(fd, "old_postcode")) {
    const geo = await geocodePostcode(str(fd, "postcode"));
    if (!geo) back(`/admin/salons/${id}`, "error", "Deze postcode herkennen we niet.");
    Object.assign(location, { postcode: geo.postcode, latitude: geo.lat, longitude: geo.lng });
  }
  const { error } = await supabase.from("salons").update({
    ...location,
    name: str(fd, "name"), district: str(fd, "district"), address: str(fd, "address"), description: str(fd, "description"),
    contact_name: str(fd, "contact_name"), contact_email: str(fd, "contact_email"), contact_phone: str(fd, "contact_phone"),
    status: str(fd, "status"), notes: str(fd, "notes"),
  }).eq("id", id);
  if (error) back(`/admin/salons/${id}`, "error", errorMessage(error));
  revalidatePath("/admin/salons", "layout");
  back(`/admin/salons/${id}`, "ok", "Salon opgeslagen.");
}

export async function upsertSalonTreatment(fd: FormData) {
  const supabase = await createClient();
  const id = str(fd, "salon");
  const override = str(fd, "credits_override");
  const { error } = await supabase.from("salon_treatments").upsert({
    salon_id: id, treatment_id: str(fd, "treatment"), payout_cents: cents(fd, "payout"),
    credits_override: override ? int(fd, "credits_override") : null, active: fd.get("active") === "on",
  });
  if (error) back(`/admin/salons/${id}`, "error", errorMessage(error));
  revalidatePath(`/admin/salons/${id}`);
  back(`/admin/salons/${id}`, "ok", "Behandeling opgeslagen.");
}

export async function removeSalonTreatment(fd: FormData) {
  const supabase = await createClient();
  const id = str(fd, "salon");
  const { error } = await supabase.from("salon_treatments").delete().eq("salon_id", id).eq("treatment_id", str(fd, "treatment"));
  if (error) back(`/admin/salons/${id}`, "error", errorMessage(error));
  revalidatePath(`/admin/salons/${id}`);
  back(`/admin/salons/${id}`, "ok", "Behandeling verwijderd.");
}

export async function addSalonMember(fd: FormData) {
  const id = str(fd, "salon");
  await rpc(`/admin/salons/${id}`, "add_salon_member", { p_salon: id, p_email: str(fd, "email"), p_role: str(fd, "role") }, "Teamlid gekoppeld aan de salon.");
}

export async function removeSalonMember(fd: FormData) {
  const supabase = await createClient();
  const id = str(fd, "salon");
  const { error } = await supabase.from("salon_members").delete().eq("salon_id", id).eq("user_id", str(fd, "user"));
  if (error) back(`/admin/salons/${id}`, "error", errorMessage(error));
  revalidatePath(`/admin/salons/${id}`);
  back(`/admin/salons/${id}`, "ok", "Teamlid ontkoppeld.");
}

export async function updateTreatment(fd: FormData) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("treatments").update({
    name: str(fd, "name"), credits: int(fd, "credits"), retail_price_cents: cents(fd, "retail"),
    default_payout_cents: cents(fd, "payout"), duration_min: int(fd, "duration"), active: fd.get("active") === "on",
  }).eq("id", str(fd, "id")).select("id");
  if (error) back("/admin/behandelingen", "error", errorMessage(error));
  if (!data?.length) back("/admin/behandelingen", "error", "Dit kon niet worden opgeslagen: je hebt hier geen rechten voor of het bestaat niet meer.");
  revalidatePath("/admin/behandelingen");
  back("/admin/behandelingen", "ok", "Behandeling opgeslagen.");
}

export async function createTreatment(fd: FormData) {
  const supabase = await createClient();
  const name = str(fd, "name");
  const slug = name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const { error } = await supabase.from("treatments").insert({
    slug, name, category: str(fd, "category") || "Overig", credits: int(fd, "credits"), retail_price_cents: cents(fd, "retail"),
    default_payout_cents: cents(fd, "payout"), duration_min: int(fd, "duration") || 45, sort: 100,
  });
  if (error) back("/admin/behandelingen", "error", errorMessage(error));
  revalidatePath("/admin/behandelingen");
  back("/admin/behandelingen", "ok", "Behandeling toegevoegd.");
}

export async function updatePlan(fd: FormData) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("plans").update({
    name: str(fd, "name"), tagline: str(fd, "tagline"), monthly_price_cents: cents(fd, "price"),
    monthly_credits: int(fd, "credits"), rollover_max: int(fd, "rollover"), active: fd.get("active") === "on",
  }).eq("id", str(fd, "id")).select("id");
  if (error) back("/admin/plannen", "error", errorMessage(error));
  if (!data?.length) back("/admin/plannen", "error", "Dit kon niet worden opgeslagen: je hebt hier geen rechten voor of het bestaat niet meer.");
  revalidatePath("/admin/plannen");
  back("/admin/plannen", "ok", "Membership opgeslagen.");
}

export async function setAdminRole(fd: FormData) {
  const role = str(fd, "role");
  await rpc("/admin/team", "admin_set_role", { p_email: str(fd, "email"), p_role: role === "none" ? null : role }, "Rol bijgewerkt.");
}

export async function adminSetBookingStatus(fd: FormData) {
  await rpc("/admin/boekingen", "salon_set_booking_status", { p_booking: str(fd, "booking"), p_status: str(fd, "status") }, "Boeking bijgewerkt.");
}
