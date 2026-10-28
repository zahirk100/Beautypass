import { createClient } from '@supabase/supabase-js';

function classifyBrevoError(details) {
  const message = String(details.message || '').toLowerCase();
  if (/\bip\b|ip address|whitelist/.test(message)) return 'ip_restricted';
  if (/key.*not found|key.*invalid|invalid.*key|unrecognised.*key|unrecognized.*key/.test(message)) return 'invalid_api_key';
  if (/not activated|not active|inactive/.test(message)) return 'inactive_resource';
  if (/template/.test(message)) return 'template_configuration';
  if (/credit/.test(message)) return 'insufficient_credits';
  return 'unclassified';
}

// API keys stay in Vercel environment variables, never in browser code.
// Also keep the sign-up in our own waitlist (Beheer → Wachtlijst). Best effort: Brevo stays leading.
async function saveToWaitlist(email) {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return;
  try {
    const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error } = await db.from('waitlist').insert({ email: email.toLowerCase(), source: 'website' });
    if (error && error.code !== '23505') console.warn('first_access_waitlist_error', error.code);
  } catch { console.warn('first_access_waitlist_error'); }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const reply = (status, data) => res.status(status).json(data);
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return reply(405, { ok: false });
  }
  const origins = new Set(['https://beautypass.nl', 'https://www.beautypass.nl']);
  if (process.env.VERCEL_URL) origins.add('https://' + process.env.VERCEL_URL);
  if (!origins.has(req.headers.origin)) return reply(403, { ok: false });
  if (!(req.headers['content-type'] || '').toLowerCase().startsWith('application/json')) {
    return reply(415, { ok: false });
  }
  let body;
  try {
    const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    if (!raw || Buffer.byteLength(raw) > 2048) return reply(413, { ok: false });
    body = JSON.parse(raw);
  } catch { return reply(400, { ok: false }); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return reply(400, { ok: false });
  if (body.website) return reply(400, { ok: false });
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return reply(400, { ok: false });
  }
  const key = process.env.BREVO_API_KEY;
  const listId = Number(process.env.BREVO_FIRST_ACCESS_LIST_ID);
  const templateId = Number(process.env.BREVO_DOI_TEMPLATE_ID);
  if (!key || !Number.isSafeInteger(listId) || listId <= 0 ||
      !Number.isSafeInteger(templateId) || templateId <= 0) {
    return reply(503, { ok: false, code: 'not_configured' });
  }
  try {
    const response = await fetch('https://api.brevo.com/v3/contacts/doubleOptinConfirmation', {
      method: 'POST',
      headers: { 'api-key': key, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ email, includeListIds: [listId], templateId,
        redirectionUrl: 'https://www.beautypass.nl/?first-access=confirmed#invitation' }),
      signal: AbortSignal.timeout(10000)
    });
    // Never report a successful subscription on a provider failure.
    if (!response.ok) {
      const details = await response.json().catch(() => ({}));
      const allowed = ['unauthorized', 'permission_denied', 'document_not_found', 'invalid_parameter', 'duplicate_parameter', 'not_enough_credits'];
      console.warn('first_access_provider_error', { status: response.status,
        code: allowed.includes(details.code) ? details.code : 'provider_error', reason: classifyBrevoError(details),
        templateDetail: /template/i.test(String(details.message || ''))
          ? String(details.message).replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]').replace(/https?:\/\/\S+/gi, '[url]').replace(/xkeysib-\S+/gi, '[key]').slice(0,240)
          : undefined });
      return reply(response.status === 429 ? 429 : 502, { ok: false });
    }
    await saveToWaitlist(email);
    return reply(200, { ok: true, confirmationRequired: true });
  } catch { console.warn('first_access_connection_error'); return reply(502, { ok: false }); }
}
