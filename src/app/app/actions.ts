"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { back, errorMessage, int, str } from "@/lib/actions";
import { geocodePostcode } from "@/lib/geo";

export async function requestMembership(fd: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("request_membership", { p_plan: str(fd, "plan") });
  if (error) back("/app/membership", "error", errorMessage(error));
  revalidatePath("/app", "layout");
  back("/app/membership", "ok", "Je aanvraag is ontvangen. We nemen contact met je op om je membership te starten.");
}

export async function bookSlot(fd: FormData) {
  const supabase = await createClient();
  const salon = str(fd, "salon");
  const slot = str(fd, "slot");
  const treatment = str(fd, "treatment");
  if (!slot || !treatment) back(`/app/boeken/${salon}`, "error", "Kies een behandeling en een tijd.");
  const { data, error } = await supabase.rpc("book_slot", { p_slot: slot, p_treatment: treatment, p_note: str(fd, "note").slice(0, 300) });
  if (error) back(`/app/boeken/${salon}`, "error", errorMessage(error));
  revalidatePath("/app", "layout");
  redirect(`/app/afspraken/${data}?nieuw=1`);
}

export async function cancelBooking(fd: FormData) {
  const supabase = await createClient();
  const to = str(fd, "back").startsWith("/app/afspraken") ? str(fd, "back") : "/app/afspraken";
  const { data, error } = await supabase.rpc("cancel_booking", { p_booking: str(fd, "booking") });
  if (error) back(to, "error", errorMessage(error));
  revalidatePath("/app", "layout");
  back("/app/afspraken", "ok", data === "cancelled" ? "Geannuleerd. Je credits staan weer op je tegoed." : "Geannuleerd. Omdat het binnen 24 uur was, worden de credits niet teruggeboekt.");
}

export async function leaveReview(fd: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const rating = int(fd, "rating");
  if (!(rating >= 1 && rating <= 5)) back("/app/afspraken", "error", "Kies 1 tot 5 sterren.");
  const { error } = await supabase.from("reviews").insert({
    booking_id: str(fd, "booking"), salon_id: str(fd, "salon"), user_id: user?.id, rating, comment: str(fd, "comment").slice(0, 1000),
  });
  if (error) back("/app/afspraken", "error", errorMessage(error));
  back("/app/afspraken", "ok", "Dank je voor je beoordeling!");
}

export async function updateProfile(fd: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const update: Record<string, unknown> = {
    first_name: str(fd, "first_name").slice(0, 60), last_name: str(fd, "last_name").slice(0, 80), phone: str(fd, "phone").slice(0, 30) || null,
  };
  const postcode = str(fd, "postcode");
  if (postcode) {
    const geo = await geocodePostcode(postcode);
    if (!geo) back("/app/profiel", "error", "Deze postcode herkennen we niet. Gebruik bijvoorbeeld 1072 LN.");
    Object.assign(update, { postcode: geo.postcode, latitude: geo.lat, longitude: geo.lng });
  } else {
    Object.assign(update, { postcode: null, latitude: null, longitude: null });
  }
  const { error } = await supabase.from("profiles").update(update).eq("id", user!.id);
  if (error) back("/app/profiel", "error", errorMessage(error));
  back("/app/profiel", "ok", "Je gegevens zijn opgeslagen.");
}

export async function changePassword(fd: FormData) {
  const supabase = await createClient();
  const password = String(fd.get("password") ?? "");
  if (password.length < 8) back("/app/profiel", "error", "Kies een wachtwoord van minimaal 8 tekens.");
  const { error } = await supabase.auth.updateUser({ password });
  if (error) back("/app/profiel", "error", "Wachtwoord wijzigen lukte niet.");
  back("/app/profiel", "ok", "Je wachtwoord is gewijzigd.");
}

const safeBack = (path: string) => (path.startsWith("/app") ? path : "/app/boeken");

export async function saveLocation(fd: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const to = safeBack(str(fd, "back"));
  const geo = await geocodePostcode(str(fd, "postcode"));
  if (!geo) back(to, "error", "Deze postcode herkennen we niet. Gebruik bijvoorbeeld 1072 LN.");
  await supabase.from("profiles").update({ postcode: geo.postcode, latitude: geo.lat, longitude: geo.lng }).eq("id", user!.id);
  // Drop a temporary browser location so the saved postcode is used
  const url = new URL(to, "http://x");
  url.searchParams.delete("lat"); url.searchParams.delete("lng"); url.searchParams.delete("ok"); url.searchParams.delete("error");
  url.searchParams.set("sort", "distance");
  revalidatePath("/app", "layout");
  redirect(url.pathname + url.search);
}

export async function toggleFavorite(fd: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const salon = str(fd, "salon");
  if (fd.get("on") === "1") await supabase.from("favorites").delete().eq("user_id", user!.id).eq("salon_id", salon);
  else await supabase.from("favorites").insert({ user_id: user!.id, salon_id: salon });
  revalidatePath("/app", "layout");
  redirect(safeBack(str(fd, "back")));
}
