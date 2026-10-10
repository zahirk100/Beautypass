import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { channel } from "@/lib/sources";

// CSV export of the waitlist; row level security makes this return nothing for non-admins
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Niet ingelogd", { status: 401 });
  const { data, error } = await supabase.from("waitlist").select("*").order("created_at").limit(50000);
  if (error) return new NextResponse("Geen toegang", { status: 403 });
  const { data: ranking } = await supabase.rpc("admin_waitlist_ranking");
  const rank = new Map((ranking ?? []).map((r: any) => [r.id, r]));
  const esc = (v: unknown) => {
    let s = String(v ?? "");
    if (/^[=+\-@]/.test(s)) s = "'" + s; // avoid spreadsheet formula injection
    return `"${s.replace(/"/g, '""')}"`;
  };
  const header = ["aangemeld", "naam", "email", "mobiel", "kanaal", "bron", "campagne", "status", "positie", "uitnodigingen", "uitgenodigd_door"];
  const lines = (data ?? []).map((w: any) =>
    [w.created_at, w.name, w.email, w.phone, channel(w.source), w.source, w.campaign, w.status, (rank.get(w.id) as any)?.waitlist_position, (rank.get(w.id) as any)?.referrals, w.referred_by].map(esc).join(";"));
  const csv = "﻿" + [header.join(";"), ...lines].join("\r\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="beautypass-wachtlijst-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
