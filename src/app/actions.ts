"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { back, str } from "@/lib/actions";

const safeNext = (next: string) => (next.startsWith("/") && !next.startsWith("//") ? next : "/start");

export async function signIn(fd: FormData) {
  const supabase = await createClient();
  const next = safeNext(str(fd, "next") || "/start");
  const { error } = await supabase.auth.signInWithPassword({ email: str(fd, "email"), password: String(fd.get("password") ?? "") });
  if (error) back(`/login?next=${encodeURIComponent(next)}`, "error", "E-mailadres of wachtwoord klopt niet, of je e-mailadres is nog niet bevestigd.");
  redirect(next);
}

export async function signUp(fd: FormData) {
  const supabase = await createClient();
  const origin = (await headers()).get("origin") ?? "";
  const password = String(fd.get("password") ?? "");
  if (password.length < 8) back("/login?mode=signup", "error", "Kies een wachtwoord van minimaal 8 tekens.");
  const { data, error } = await supabase.auth.signUp({
    email: str(fd, "email"),
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
      data: { first_name: str(fd, "first_name").slice(0, 60), last_name: str(fd, "last_name").slice(0, 80) },
    },
  });
  if (error) back("/login?mode=signup", "error", error.message.includes("registered") ? "Er bestaat al een account met dit e-mailadres." : "Account aanmaken lukte niet. Probeer het opnieuw.");
  if (data.session) redirect("/start");
  back("/login", "ok", "Bijna klaar! Bevestig je e-mailadres via de link in je inbox en log daarna in.");
}

export async function resetPassword(fd: FormData) {
  const supabase = await createClient();
  const origin = (await headers()).get("origin") ?? "";
  await supabase.auth.resetPasswordForEmail(str(fd, "email"), { redirectTo: `${origin}/auth/callback?next=/app/profiel` });
  back("/login", "ok", "Als dit e-mailadres bij ons bekend is, ontvang je een link om een nieuw wachtwoord in te stellen.");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
