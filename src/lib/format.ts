const TZ = "Europe/Amsterdam";

export const euro = (cents: number | null | undefined) =>
  new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format((cents ?? 0) / 100);

export const dateLong = (iso: string) =>
  new Intl.DateTimeFormat("nl-NL", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" }).format(new Date(iso));

export const dateShort = (iso: string) =>
  new Intl.DateTimeFormat("nl-NL", { timeZone: TZ, day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));

export const time = (iso: string) =>
  new Intl.DateTimeFormat("nl-NL", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

export const dayKey = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));

export const monthLabel = (d: Date) =>
  new Intl.DateTimeFormat("nl-NL", { timeZone: TZ, month: "long", year: "numeric" }).format(d);

/** Converts a wall-clock date + time in Amsterdam ("2026-11-03", "14:30") to a UTC Date. */
export function amsterdamToUtc(date: string, hm: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = hm.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  // Offset of Amsterdam at that moment (handles summer/winter time)
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).formatToParts(new Date(guess));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asLocal = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  return new Date(guess - (asLocal - guess));
}

/** Start of the current month in Amsterdam, as YYYY-MM-01. */
export function currentMonth(): string {
  return dayKey(new Date().toISOString()).slice(0, 8) + "01";
}

export const statusLabel: Record<string, string> = {
  booked: "Gepland",
  completed: "Voltooid",
  no_show: "No-show",
  cancelled: "Geannuleerd",
  cancelled_late: "Te laat geannuleerd",
  cancelled_by_salon: "Geannuleerd door salon",
  pending: "In behandeling",
  active: "Actief",
  paused: "Gepauzeerd",
  open: "Vrij",
  blocked: "Geblokkeerd",
  lead: "Lead",
  waiting: "Wachtend",
  invited: "Uitgenodigd",
  member: "Member",
  unsubscribed: "Afgemeld",
};

export const roleLabel: Record<string, string> = {
  super_admin: "Super-admin",
  ops: "Operations",
  support: "Support",
  finance: "Finance",
  owner: "Eigenaar",
  staff: "Medewerker",
};

export const weekdayShort = (iso: string) =>
  new Intl.DateTimeFormat("nl-NL", { timeZone: TZ, weekday: "short" }).format(new Date(iso)).replace(".", "");

export const dayNumber = (iso: string) =>
  new Intl.DateTimeFormat("nl-NL", { timeZone: TZ, day: "numeric" }).format(new Date(iso));
