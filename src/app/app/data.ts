import type { SupabaseClient } from "@supabase/supabase-js";

export async function loadMembership(supabase: SupabaseClient, userId: string) {
  const [{ data: membership }, { data: balance }] = await Promise.all([
    supabase.from("memberships").select("*, plans(*)").eq("user_id", userId).neq("status", "cancelled").maybeSingle(),
    supabase.rpc("my_credit_balance"),
  ]);
  return { membership: membership as any, balance: (balance as number) ?? 0 };
}
