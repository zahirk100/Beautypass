import { NextResponse } from "next/server";
import { referralEmail, saveContact, sendEmail, welcomeEmail } from "@/lib/email";
import { hookAuthorised } from "@/lib/hooks";

// Called by the database after a waitlist sign-up (supabase/migrations/008_waitlist_emails.sql).

export async function POST(request: Request) {
  if (!hookAuthorised(request)) return new NextResponse("Unauthorized", { status: 401 });
  const d = await request.json().catch(() => null);
  if (!d?.email || !d?.name || !d?.referral_code) return new NextResponse("Bad request", { status: 400 });

  const position = Number(d.position) || 0;
  const total = Math.max(Number(d.total) || 0, position);
  try {
    if (d.type === "signup") {
      await sendEmail({ email: d.email, name: d.name }, welcomeEmail({ name: d.name, position, total, code: d.referral_code }));
      // The contact list is for later launch mailings; a failure there must not hide a sent welcome mail
      await saveContact({ email: d.email, name: d.name, code: d.referral_code }).catch((e) => console.error("brevo contact", e));
    } else if (d.type === "referral") {
      await sendEmail({ email: d.email, name: d.name },
        referralEmail({ name: d.name, friend: String(d.friend ?? ""), position, total, referrals: Number(d.referrals) || 1, code: d.referral_code }));
    } else {
      return new NextResponse("Unknown type", { status: 400 });
    }
  } catch (e) {
    console.error("waitlist mail", e);
    return new NextResponse("Mail failed", { status: 502 });
  }
  return NextResponse.json({ ok: true });
}

// Setup check: shows whether the settings are present on this deployment, never their values
export function GET() {
  return NextResponse.json({
    WAITLIST_HOOK_SECRET: Boolean(process.env.WAITLIST_HOOK_SECRET),
    BREVO_API_KEY: Boolean(process.env.BREVO_API_KEY),
    BREVO_LIST_ID: process.env.BREVO_LIST_ID ? Number(process.env.BREVO_LIST_ID) || "geen getal" : false,
    AUTH_EMAIL_HOOK_SECRET: Boolean(process.env.AUTH_EMAIL_HOOK_SECRET),
  });
}
