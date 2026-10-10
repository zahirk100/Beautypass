import { NextResponse } from "next/server";
import * as M from "@/lib/email";
import { hookAuthorised } from "@/lib/hooks";

// Called by the database on membership and booking changes and by the hourly reminder job
// (supabase/migrations/009_platform_emails.sql). Each event can mail the member, the salon and/or the team.

type Job = { to: string; name?: string; mail: M.Mail };

function jobs(d: any): Job[] {
  const member = (mail: M.Mail): Job => ({ to: d.member_email ?? d.email, name: d.member_name ?? d.name, mail });
  const salon = (mail: M.Mail): Job[] => (Array.isArray(d.salon_emails) ? d.salon_emails : []).map((to: string) => ({ to, mail }));
  switch (d.type) {
    case "membership_requested":
      return [member(M.membershipRequestedEmail(d)), { to: M.adminInbox(), mail: M.adminMembershipRequestedEmail(d) }];
    case "membership_activated": return [member(M.membershipActivatedEmail(d))];
    case "membership_paused": return [member(M.membershipPausedEmail(d))];
    case "membership_cancelled": return [member(M.membershipCancelledEmail(d))];
    case "credits_renewed": return [member(M.creditsRenewedEmail(d))];
    case "booking_created": return [member(M.bookingConfirmedEmail(d)), ...salon(M.salonNewBookingEmail(d))];
    case "booking_reminder": return [member(M.bookingReminderEmail(d))];
    case "booking_cancelled":
      return [member(M.bookingCancelledEmail({ ...d, refunded: !d.late })), ...salon(M.salonBookingCancelledEmail(d))];
    case "booking_cancelled_by_salon": return [member(M.bookingCancelledBySalonEmail(d))];
    case "booking_completed": return [member(M.bookingCompletedEmail(d))];
    case "booking_no_show": return [member(M.bookingNoShowEmail(d))];
    default: return [];
  }
}

export async function POST(request: Request) {
  if (!hookAuthorised(request)) return new NextResponse("Unauthorized", { status: 401 });
  const d = await request.json().catch(() => null);
  if (!d?.type) return new NextResponse("Bad request", { status: 400 });
  const list = jobs(d);
  if (list.length === 0) return new NextResponse("Unknown type", { status: 400 });

  const results = await Promise.allSettled(list.map((j) => M.sendEmail({ email: j.to, name: j.name }, j.mail)));
  const failed = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
  if (failed.length) {
    console.error("event mail", d.type, failed.map((f) => String(f.reason)));
    return new NextResponse(`Mail failed (${failed.length}/${list.length})`, { status: 502 });
  }
  return NextResponse.json({ ok: true, sent: list.length });
}
