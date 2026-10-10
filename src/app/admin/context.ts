import { redirect } from "next/navigation";
import { getContext } from "@/lib/auth";

export async function getAdminContext() {
  const ctx = await getContext();
  if (!ctx.profile?.admin_role) redirect("/start");
  return { ...ctx, role: ctx.profile.admin_role };
}
