import { createHmac, timingSafeEqual } from "node:crypto";

const same = (a: string, b: string) => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/** Database → website calls (pg_net) carry WAITLIST_HOOK_SECRET in the x-hook-secret header. */
export function hookAuthorised(request: Request) {
  const secret = process.env.WAITLIST_HOOK_SECRET;
  const header = request.headers.get("x-hook-secret");
  return Boolean(secret && header && same(header, secret));
}

/**
 * Supabase Auth hooks are signed with the Standard Webhooks scheme:
 * base64(HMAC-SHA256(secret, `${id}.${timestamp}.${body}`)), secret given as "v1,whsec_<base64>".
 */
export function verifyStandardWebhook(body: string, headers: Headers, secretSetting: string | undefined) {
  if (!secretSetting) return false;
  const id = headers.get("webhook-id"), ts = headers.get("webhook-timestamp"), sigs = headers.get("webhook-signature");
  if (!id || !ts || !sigs) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 5 * 60) return false;
  const key = Buffer.from(secretSetting.replace(/^v1,/, "").replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key).update(`${id}.${ts}.${body}`).digest("base64");
  return sigs.split(" ").some((s) => same(s.replace(/^v1,/, ""), expected));
}
