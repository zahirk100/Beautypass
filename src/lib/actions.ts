import { redirect } from "next/navigation";

/** Redirect back to a page with a flash message in the query string. */
export function back(path: string, kind: "ok" | "error", message: string): never {
  const sep = path.includes("?") ? "&" : "?";
  redirect(`${path}${sep}${kind}=${encodeURIComponent(message)}`);
}

/** Turns a Postgres/Supabase error into a readable Dutch message. */
export function errorMessage(err: { message?: string } | null | undefined): string {
  const msg = err?.message ?? "Er ging iets mis";
  if (msg.includes("row-level security")) return "Je hebt hier geen rechten voor";
  if (msg.includes("duplicate key")) return "Dit bestaat al";
  return msg;
}

export const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
export const int = (fd: FormData, key: string) => Math.round(Number(String(fd.get(key) ?? "").replace(",", ".")));
export const cents = (fd: FormData, key: string) => Math.round(Number(String(fd.get(key) ?? "").replace(",", ".")) * 100);
