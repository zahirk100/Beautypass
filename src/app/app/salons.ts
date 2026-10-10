import type { SupabaseClient } from "@supabase/supabase-js";
import { dayKey } from "@/lib/format";
import { distanceKm, type Point } from "@/lib/geo";

export type BrowseSalon = {
  id: string; name: string; district: string; address: string; description: string; tagline: string; cover: string;
  lat: number | null; lng: number | null; distance: number | null;
  rating: number | null; reviews: number; favorite: boolean;
  treatments: { id: string; slug: string; name: string; credits: number }[];
  nextSlot: string | null; slotsToday: number; slotsTomorrow: number; slotsWeek: number;
};

/** Everything the member needs to compare salons: offer, rating, distance, availability and favourites. */
export async function loadSalons(supabase: SupabaseClient, userId: string, me: Point | null): Promise<BrowseSalon[]> {
  const [{ data: salons }, { data: offers }, { data: ratings }, { data: slots }, { data: favs }] = await Promise.all([
    supabase.from("salons").select("id, name, district, address, description, tagline, cover_url, latitude, longitude").eq("status", "active").order("name"),
    supabase.from("salon_treatments").select("salon_id, credits_override, treatments(id, slug, name, credits, sort, active)").eq("active", true),
    supabase.rpc("salon_ratings"),
    supabase.from("slots").select("salon_id, starts_at").eq("status", "open").gt("starts_at", new Date().toISOString())
      .lt("starts_at", new Date(Date.now() + 14 * 864e5).toISOString()).order("starts_at").limit(5000),
    supabase.from("favorites").select("salon_id").eq("user_id", userId),
  ]);
  const today = dayKey(new Date().toISOString());
  const tomorrow = dayKey(new Date(Date.now() + 864e5).toISOString());
  const weekEnd = Date.now() + 7 * 864e5;
  const favSet = new Set((favs ?? []).map((f: any) => f.salon_id));

  return (salons ?? []).map((s: any) => {
    const own = (slots ?? []).filter((x: any) => x.salon_id === s.id);
    const r = (ratings ?? []).find((x: any) => x.salon_id === s.id);
    const point = s.latitude != null && s.longitude != null ? { lat: s.latitude, lng: s.longitude } : null;
    return {
      id: s.id, name: s.name, district: s.district, address: s.address, description: s.description, tagline: s.tagline ?? "", cover: s.cover_url ?? "",
      lat: point?.lat ?? null, lng: point?.lng ?? null,
      distance: me && point ? distanceKm(me, point) : null,
      rating: r ? Number(r.avg_rating) : null, reviews: r?.review_count ?? 0,
      favorite: favSet.has(s.id),
      treatments: (offers ?? []).filter((o: any) => o.salon_id === s.id && o.treatments?.active)
        .sort((a: any, b: any) => a.treatments.sort - b.treatments.sort)
        .map((o: any) => ({ id: o.treatments.id, slug: o.treatments.slug, name: o.treatments.name, credits: o.credits_override ?? o.treatments.credits })),
      nextSlot: own[0]?.starts_at ?? null,
      slotsToday: own.filter((x: any) => dayKey(x.starts_at) === today).length,
      slotsTomorrow: own.filter((x: any) => dayKey(x.starts_at) === tomorrow).length,
      slotsWeek: own.filter((x: any) => new Date(x.starts_at).getTime() < weekEnd).length,
    };
  });
}

/** Human label for the next free time: "vandaag 14:00", "morgen 10:00", "do 16 okt 11:00". */
export function nextLabel(iso: string): string {
  const tz = "Europe/Amsterdam";
  const t = new Intl.DateTimeFormat("nl-NL", { timeZone: tz, hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
  const k = dayKey(iso);
  if (k === dayKey(new Date().toISOString())) return `vandaag ${t}`;
  if (k === dayKey(new Date(Date.now() + 864e5).toISOString())) return `morgen ${t}`;
  return new Intl.DateTimeFormat("nl-NL", { timeZone: tz, weekday: "short", day: "numeric", month: "short" }).format(new Date(iso)) + ` ${t}`;
}

export function myLocation(sp: Record<string, string>, profile: { latitude?: number | null; longitude?: number | null } | null): Point | null {
  const lat = Number(sp.lat), lng = Number(sp.lng);
  if (sp.lat && sp.lng && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng };
  if (profile?.latitude != null && profile?.longitude != null) return { lat: profile.latitude, lng: profile.longitude };
  return null;
}
