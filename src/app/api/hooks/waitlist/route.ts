import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { referralEmail, saveContact, sendEmail, welcomeEmail } from "@/lib/email";

// Called by the database after a waitlist sign-up (supabase/migrations/008_waitlist_emails.sql).
// Protected by a shared secret: WAITLIST_HOOK_SECRET in Vercel = waitlist_hook_secret in private.settings.

function authorised(header: string | null) {
  const secret = process.env.WAITLIST_HOOK_SECRET;
  if (!secret || !header) return false;
  const a = Buffer.from(header), b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  if (!authorised(request.headers.get("x-hook-secret"))) return new NextResponse("Unauthorized", { status: 401 });
  const p = await request.json().catch(() => null);
  if (!p?.email || !p?.name || !p?.referral_code) return new NextResponse("Bad request", { status: 400 });

  const position = Number(p.position) || 0;
  const total = Math.max(Number(p.total) || 0, position);
  try {
    if (p.type === "signup") {
      await sendEmail({ email: p.email, name: p.name }, welcomeEmail({ name: p.name, position, total, code: p.referral_code }));
      // The contact list is for later launch mailings; a failure there must not hide a sent welcome mail
      await saveContact({ email: p.email, name: p.name, code: p.referral_code }).catch((e) => console.error("brevo contact", e));
    } else if (p.type === "referral") {
      await sendEmail({ email: p.email, name: p.name },
        referralEmail({ name: p.name, friend: String(p.friend ?? "Een vriendin"), position, total, referrals: Number(p.referrals) || 1, code: p.referral_code }));
    } else {
      return new NextResponse("Unknown type", { status: 400 });
    }
  } catch (e) {
    console.error("waitlist mail", e);
    return new NextResponse("Mail failed", { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
