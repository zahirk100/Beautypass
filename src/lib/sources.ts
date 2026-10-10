/** Groups raw waitlist sources (utm_source or referrer URL) into readable channels. */
export function channel(source: string | null | undefined): string {
  const s = (source ?? "").toLowerCase();
  if (!s || s === "direct") return "Direct";
  if (s.includes("tiktok")) return "TikTok";
  if (s.includes("instagram") || s === "ig") return "Instagram";
  if (s.includes("facebook") || s === "fb") return "Facebook";
  if (s.includes("google")) return "Google";
  if (s === "share") return "Gedeeld door vriendin";
  if (s.includes("creator")) return "Creators";
  if (s.startsWith("http")) {
    try { return new URL(s).hostname.replace(/^www\./, ""); } catch { return "Overig"; }
  }
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function countBy<T>(rows: T[], key: (r: T) => string): [string, number][] {
  const m = new Map<string, number>();
  rows.forEach((r) => m.set(key(r), (m.get(key(r)) ?? 0) + 1));
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}
