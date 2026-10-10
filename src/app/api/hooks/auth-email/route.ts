import { NextResponse } from "next/server";
import { authEmail, sendEmail } from "@/lib/email";
import { verifyStandardWebhook } from "@/lib/hooks";
import { SUPABASE_URL } from "@/lib/supabase/config";

// Supabase Auth "Send Email" hook: every account mail (confirm sign-up, reset password, magic link,
// e-mail change, invite) goes through here instead of Supabase's own mailer.
// Setup: Supabase → Authentication → Hooks → Send Email → HTTPS → this URL; secret in AUTH_EMAIL_HOOK_SECRET.

type Payload = {
  user: { email: string; new_email?: string; user_metadata?: { first_name?: string } };
  email_data: { token: string; token_hash: string; redirect_to: string; email_action_type: string; token_new?: string; token_hash_new?: string };
};

const fail = (status: number, message: string) => NextResponse.json({ error: { http_code: status, message } }, { status });

const verifyUrl = (tokenHash: string, type: string, redirectTo: string) =>
  `${SUPABASE_URL}/auth/v1/verify?token=${encodeURIComponent(tokenHash)}&type=${encodeURIComponent(type)}&redirect_to=${encodeURIComponent(redirectTo)}`;

export async function POST(request: Request) {
  const body = await request.text();
  if (!verifyStandardWebhook(body, request.headers, process.env.AUTH_EMAIL_HOOK_SECRET)) return fail(401, "Invalid signature");
  let d: Payload;
  try { d = JSON.parse(body); } catch { return fail(400, "Invalid JSON"); }
  const { user, email_data: e } = d;
  if (!user?.email || !e?.email_action_type) return fail(400, "Missing fields");

  const name = user.user_metadata?.first_name;
  const redirectTo = e.redirect_to || "https://www.beautypass.nl/auth/callback";
  try {
    if (e.email_action_type === "email_change" && user.new_email) {
      // Secure e-mail change: one link to the current address, one to the new address
      const jobs: Promise<void>[] = [];
      if (e.token_hash) jobs.push(sendEmail({ email: user.email }, authEmail("email_change", { name, url: verifyUrl(e.token_hash, "email_change", redirectTo), newEmail: user.new_email })));
      if (e.token_hash_new) jobs.push(sendEmail({ email: user.new_email }, authEmail("email_change", { name, url: verifyUrl(e.token_hash_new, "email_change", redirectTo), newEmail: user.new_email })));
      await Promise.all(jobs);
    } else {
      await sendEmail({ email: user.email }, authEmail(e.email_action_type, { name, url: verifyUrl(e.token_hash, e.email_action_type, redirectTo), token: e.token }));
    }
  } catch (err) {
    console.error("auth mail", err);
    return fail(502, "E-mail kon niet worden verstuurd");
  }
  return NextResponse.json({});
}
