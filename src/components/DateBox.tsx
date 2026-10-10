import { dayNumber, weekdayShort } from "@/lib/format";

export function DateBox({ iso }: { iso: string }) {
  return <div className="datebox">{weekdayShort(iso)}<b>{dayNumber(iso)}</b></div>;
}
