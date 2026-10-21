'use strict';

// API keys stay in Vercel environment variables, never in browser code.
module.exports = async function handler(req, res) {
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
        redirectionUrl: 'https://beautypass.nl/#invitation' }),
      signal: AbortSignal.timeout(10000)
    });
    // Never report a successful subscription on a provider failure.
    if (!response.ok) {
      const details = await response.json().catch(() => ({}));
      const allowed = ['unauthorized', 'permission_denied', 'document_not_found', 'invalid_parameter', 'duplicate_parameter', 'not_enough_credits'];
      console.warn('first_access_provider_error', { status: response.status,
        code: allowed.includes(details.code) ? details.code : 'provider_error' });
      return reply(response.status === 429 ? 429 : 502, { ok: false });
    }
    return reply(200, { ok: true, confirmationRequired: true });
  } catch { console.warn('first_access_connection_error'); return reply(502, { ok: false }); }
};
