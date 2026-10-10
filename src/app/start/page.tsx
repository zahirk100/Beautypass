import { redirect } from "next/navigation";
import { getContext } from "@/lib/auth";

// Sends each user to the environment that fits their role
export default async function Start() {
  const { profile, salons } = await getContext();
  if (profile?.admin_role) redirect("/admin");
  if (salons.length > 0) redirect("/salon");
  redirect("/app");
}
