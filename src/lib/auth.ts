import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type SalonLink = { salon_id: string; role: "owner" | "staff"; salons: { id: string; name: string; status: string } | null };

/** Loads the logged-in user with profile and salon links; redirects to login when there is none. */
export async function getContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: salons }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("salon_members").select("salon_id, role, salons(id, name, status)").eq("user_id", user.id),
  ]);
  return {
    supabase,
    user,
    profile: profile as { id: string; first_name: string; last_name: string; phone: string | null; admin_role: string | null } | null,
    salons: (salons ?? []) as unknown as SalonLink[],
  };
}

export const ADMIN_WRITE = {
  ops: ["super_admin", "ops"],
  support: ["super_admin", "ops", "support"],
  finance: ["super_admin", "finance"],
  super: ["super_admin"],
};

export const can = (role: string | null | undefined, allowed: string[]) => !!role && allowed.includes(role);
