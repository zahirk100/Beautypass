export type Point = { lat: number; lng: number };

/** "1072 ln" → "1072LN"; also accepts only the four digits. Returns null when it is not a Dutch postcode. */
export function normalizePostcode(input: string): string | null {
  const m = input.toUpperCase().replace(/\s+/g, "").match(/^([1-9]\d{3})([A-Z]{2})?$/);
  return m ? m[1] + (m[2] ?? "") : null;
}

// Rough centre of Amsterdam areas per postcode range; used when the PDOK lookup is unavailable.
const AREAS: [number, number, number, number][] = [
  [1011, 1011, 52.3725, 4.901], [1012, 1012, 52.374, 4.893], [1013, 1013, 52.388, 4.883], [1014, 1014, 52.389, 4.85],
  [1015, 1015, 52.378, 4.882], [1016, 1016, 52.372, 4.883], [1017, 1017, 52.363, 4.895], [1018, 1018, 52.366, 4.915],
  [1019, 1019, 52.373, 4.94], [1020, 1039, 52.395, 4.915], [1051, 1052, 52.383, 4.875], [1053, 1054, 52.365, 4.87],
  [1055, 1058, 52.37, 4.85], [1059, 1059, 52.353, 4.855], [1060, 1069, 52.36, 4.8], [1071, 1071, 52.356, 4.88],
  [1072, 1073, 52.354, 4.895], [1074, 1074, 52.352, 4.905], [1075, 1077, 52.348, 4.865], [1078, 1079, 52.345, 4.9],
  [1081, 1083, 52.333, 4.875], [1086, 1087, 52.355, 4.99], [1091, 1098, 52.357, 4.93], [1101, 1109, 52.31, 4.96],
];

function approximate(pc: string): Point | null {
  const n = Number(pc.slice(0, 4));
  const hit = AREAS.find(([from, to]) => n >= from && n <= to);
  return hit ? { lat: hit[2], lng: hit[3] } : null;
}

/** Looks up a postcode via the free PDOK Locatieserver (Dutch government), with an Amsterdam fallback. */
export async function geocodePostcode(input: string): Promise<(Point & { postcode: string; approx: boolean }) | null> {
  const pc = normalizePostcode(input);
  if (!pc) return null;
  try {
    const url = `https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?q=${pc}&fq=type:postcode&rows=1&fl=centroide_ll`;
    const res = await fetch(url, { signal: AbortSignal.timeout(4000), next: { revalidate: 60 * 60 * 24 * 30 } });
    if (res.ok) {
      const json = await res.json();
      const m = String(json?.response?.docs?.[0]?.centroide_ll ?? "").match(/POINT\(([\d.]+) ([\d.]+)\)/);
      if (m) return { lng: Number(m[1]), lat: Number(m[2]), postcode: pc, approx: false };
    }
  } catch {
    // Network problem: fall back to the area estimate below
  }
  const p = approximate(pc);
  return p ? { ...p, postcode: pc, approx: true } : null;
}

export function distanceKm(a: Point, b: Point): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const formatDistance = (km: number) =>
  km < 1 ? `${Math.max(50, Math.round((km * 1000) / 50) * 50)} m` : `${km.toFixed(1).replace(".", ",")} km`;

/** Cycling time in minutes at ~15 km/h over a slightly detoured route. */
export const bikeMinutes = (km: number) => Math.max(1, Math.round(((km * 1.25) / 15) * 60));

export const routeUrl = (p: Point) => `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}&travelmode=bicycling`;
