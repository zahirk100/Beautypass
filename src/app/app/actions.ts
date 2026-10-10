"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { back, errorMessage, int, str } from "@/lib/actions";

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
  const { error } = await supabase.rpc("book_slot", { p_slot: slot, p_treatment: treatment });
  if (error) back(`/app/boeken/${salon}`, "error", errorMessage(error));
  revalidatePath("/app", "layout");
  back("/app/afspraken", "ok", "Geboekt! Je afspraak staat hieronder.");
}

export async function cancelBooking(fd: FormData) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cancel_booking", { p_booking: str(fd, "booking") });
  if (error) back("/app/afspraken", "error", errorMessage(error));
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
  const { error } = await supabase.from("profiles").update({
    first_name: str(fd, "first_name").slice(0, 60), last_name: str(fd, "last_name").slice(0, 80), phone: str(fd, "phone").slice(0, 30) || null,
  }).eq("id", user!.id);
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
