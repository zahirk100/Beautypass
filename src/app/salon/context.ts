import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getContext } from "@/lib/auth";

export const SALON_COOKIE = "bp_salon";

/** Logged-in salon user plus the salon they are currently working in. */
export async function getSalonContext() {
  const ctx = await getContext();
  if (ctx.salons.length === 0) redirect("/start");
  const chosen = (await cookies()).get(SALON_COOKIE)?.value;
  const current = ctx.salons.find((s) => s.salon_id === chosen) ?? ctx.salons[0];
  return { ...ctx, current, salonId: current.salon_id, isOwner: current.role === "owner" };
}
