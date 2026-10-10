"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { back, errorMessage, int, str } from "@/lib/actions";
import { amsterdamToUtc } from "@/lib/format";
import { geocodePostcode } from "@/lib/geo";
import { handleFrom, websiteFrom } from "@/lib/social";
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
  const { data, error } = await supabase.from("slots").delete().eq("id", str(fd, "slot")).neq("status", "booked").select("id");
  if (error) back("/salon/agenda", "error", errorMessage(error));
  if (!data?.length) back("/salon/agenda", "error", "Deze tijd is inmiddels geboekt en kan niet meer worden verwijderd.");
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

export async function addStaff(fd: FormData) {
  const { supabase, salonId } = await getSalonContext();
  const { error } = await supabase.rpc("add_salon_member", { p_salon: salonId, p_email: str(fd, "email"), p_role: "staff" });
  if (error) back("/salon/instellingen", "error", errorMessage(error));
  revalidatePath("/salon/instellingen");
  back("/salon/instellingen", "ok", "Medewerker toegevoegd.");
}

export async function removeStaff(fd: FormData) {
  const { supabase, salonId } = await getSalonContext();
  const { data, error } = await supabase.from("salon_members").delete().eq("salon_id", salonId).eq("user_id", str(fd, "user")).eq("role", "staff").select("user_id");
  if (error) back("/salon/instellingen", "error", errorMessage(error));
  if (!data?.length) back("/salon/instellingen", "error", "Alleen de eigenaar kan medewerkers verwijderen.");
  revalidatePath("/salon/instellingen");
  back("/salon/instellingen", "ok", "Medewerker verwijderd.");
}

const BUCKET = "salon-photos";

export async function updateSalonDetails(fd: FormData) {
  const { supabase, salonId } = await getSalonContext();
  const pc = str(fd, "postcode");
  const geo = pc && pc !== str(fd, "old_postcode") ? await geocodePostcode(pc) : null;
  if (pc && pc !== str(fd, "old_postcode") && !geo) back("/salon/profiel", "error", "Deze postcode herkennen we niet.");
  const { error } = await supabase.rpc("update_salon_details", {
    p_salon: salonId, p_tagline: str(fd, "tagline"), p_description: str(fd, "description"),
    p_address: str(fd, "address"), p_district: str(fd, "district"),
    p_postcode: geo?.postcode ?? null, p_latitude: geo?.lat ?? null, p_longitude: geo?.lng ?? null,
    p_opening_hours: str(fd, "opening_hours"), p_instagram: handleFrom(str(fd, "instagram")),
    p_tiktok: handleFrom(str(fd, "tiktok")), p_website: websiteFrom(str(fd, "website")),
  });
  if (error) back("/salon/profiel", "error", errorMessage(error));
  revalidatePath("/salon", "layout");
  back("/salon/profiel", "ok", "Je salonprofiel is opgeslagen.");
}

/** Uploads one or more photos to the salon's folder and adds them as cover or to the gallery. */
export async function uploadSalonPhoto(fd: FormData) {
  const { supabase, salonId } = await getSalonContext();
  const kind = str(fd, "kind") === "cover" ? "cover" : "gallery";
  const files = fd.getAll("photo").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) back("/salon/profiel", "error", "Kies eerst een foto.");
  const { data: salon } = await supabase.from("salons").select("cover_url, gallery").eq("id", salonId).single();
  const gallery: string[] = salon?.gallery ?? [];
  if (kind === "gallery" && gallery.length + files.length > 8) back("/salon/profiel", "error", "Maximaal 8 foto's in de galerij. Verwijder eerst een foto.");

  const urls: string[] = [];
  for (const file of files.slice(0, kind === "cover" ? 1 : 8)) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) back("/salon/profiel", "error", "Alleen jpg, png of webp.");
    if (file.size > 3.5 * 1024 * 1024) back("/salon/profiel", "error", "Deze foto is te groot (max. 3,5 MB).");
    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const path = `${salonId}/${kind}-${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, cacheControl: "31536000" });
    if (error) back("/salon/profiel", "error", "Uploaden lukte niet: " + error.message);
    urls.push(supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl);
  }
  const { error } = await supabase.rpc("update_salon_media", {
    p_salon: salonId,
    p_cover: kind === "cover" ? urls[0] : salon?.cover_url ?? "",
    p_gallery: kind === "gallery" ? [...gallery, ...urls] : gallery,
  });
  if (error) back("/salon/profiel", "error", errorMessage(error));
  if (kind === "cover" && salon?.cover_url) await removeStored(supabase, salon.cover_url);
  revalidatePath("/salon", "layout");
  back("/salon/profiel", "ok", kind === "cover" ? "Omslagfoto bijgewerkt." : "Foto's toegevoegd.");
}

export async function removeSalonPhoto(fd: FormData) {
  const { supabase, salonId } = await getSalonContext();
  const url = str(fd, "url");
  const { data: salon } = await supabase.from("salons").select("cover_url, gallery").eq("id", salonId).single();
  const isCover = salon?.cover_url === url;
  const { error } = await supabase.rpc("update_salon_media", {
    p_salon: salonId,
    p_cover: isCover ? "" : salon?.cover_url ?? "",
    p_gallery: (salon?.gallery ?? []).filter((u: string) => u !== url),
  });
  if (error) back("/salon/profiel", "error", errorMessage(error));
  await removeStored(supabase, url);
  revalidatePath("/salon", "layout");
  back("/salon/profiel", "ok", "Foto verwijderd.");
}

async function removeStored(supabase: Awaited<ReturnType<typeof createClient>>, url: string) {
  const marker = `/object/public/${BUCKET}/`;
  const i = url.indexOf(marker);
  if (i >= 0) await supabase.storage.from(BUCKET).remove([decodeURIComponent(url.slice(i + marker.length))]);
}
