import { statusLabel } from "@/lib/format";

const tone: Record<string, string> = {
  active: "ok", completed: "ok", open: "ok", member: "ok",
  pending: "warn", booked: "", lead: "warn", invited: "warn", waiting: "neutral",
  paused: "neutral", blocked: "neutral", unsubscribed: "neutral",
  cancelled: "neutral", cancelled_late: "bad", cancelled_by_salon: "neutral", no_show: "bad",
};

export function StatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return <span className="badge neutral">Geen</span>;
  return <span className={`badge ${tone[status] ?? ""}`}>{statusLabel[status] ?? status}</span>;
}
