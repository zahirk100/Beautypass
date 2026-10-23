// Shared helpers for the server functions in /api (files starting with _ are not routes on Vercel).
// Secrets only come from environment variables; nothing here is sent to the browser.
import { createClient } from '@supabase/supabase-js';

export const env = (k, fallback) => process.env[k] ?? fallback;
export const APP_URL = () => env('APP_URL', 'https://www.beautypass.nl').replace(/\/$/, '');

let admin;
export function db() {
  if (!admin) {
    const key = env('SUPABASE_SERVICE_ROLE_KEY') || env('SUPABASE_SECRET_KEY');
    if (!env('SUPABASE_URL') || !key) throw new HttpError(503, 'De server is nog niet gekoppeld aan de database');
    admin = createClient(env('SUPABASE_URL'), key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return admin;
}

export class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }

export async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const raw = typeof req.body === 'string' ? req.body : await new Promise((ok, fail) => {
    let s = ''; req.on('data', (c) => { s += c; if (s.length > 20000) fail(new HttpError(413, 'Te groot')); }); req.on('end', () => ok(s)); req.on('error', fail);
  });
  if (!raw) return {};
  if ((req.headers['content-type'] || '').includes('application/x-www-form-urlencoded')) return Object.fromEntries(new URLSearchParams(raw));
  try { return JSON.parse(raw); } catch { throw new HttpError(400, 'Ongeldige gegevens'); }
}

// Wraps a handler: JSON in/out, errors become { ok:false, error } with the right status
export function handler(fn, { methods = ['POST'] } = {}) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!methods.includes(req.method)) { res.setHeader('Allow', methods.join(', ')); return res.status(405).json({ ok: false, error: 'Methode niet toegestaan' }); }
    try {
      const out = await fn(req, res);
      if (!res.headersSent) res.status(200).json({ ok: true, ...(out || {}) });
    } catch (e) {
      const status = e instanceof HttpError ? e.status : 500;
      if (status >= 500) console.error('api_error', req.url, e && e.message);
      if (!res.headersSent) res.status(status).json({ ok: false, error: status >= 500 && !(e instanceof HttpError) ? 'Er ging iets mis. Probeer het opnieuw.' : e.message });
    }
  };
}

// The logged-in user behind the request (Supabase access token in Authorization: Bearer …)
export async function currentUser(req) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) throw new HttpError(401, 'Log opnieuw in');
  const { data, error } = await db().auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, 'Je sessie is verlopen. Log opnieuw in.');
  const { data: prof } = await db().from('profiles').select('id,email,name,role').eq('id', data.user.id).single();
  let perms = [];
  if (prof && prof.role === 'owner') perms = ['dash', 'agenda', 'members', 'plans', 'team', 'waitlist', 'settings', 'finance'];
  else if (prof && prof.role !== 'member') perms = (await db().from('role_perms').select('perms').eq('role', prof.role).single()).data?.perms || [];
  return { id: data.user.id, email: data.user.email, role: prof ? prof.role : 'member', perms, name: prof ? prof.name : '' };
}
export const requirePerm = (user, perm) => { if (!user.perms.includes(perm)) throw new HttpError(403, 'Hiervoor heb je geen rechten'); };

export async function one(query) {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
}

// ───────────────────────────── Mollie ─────────────────────────────
const MOLLIE = () => env('MOLLIE_API_URL', 'https://api.mollie.com/v2');
export async function mollie(method, path, body) {
  const key = env('MOLLIE_API_KEY');
  if (!key) throw new HttpError(503, 'Betalen is nog niet gekoppeld (Mollie)');
  const res = await fetch(MOLLIE() + path, {
    method, headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15000),
  });
  const data = res.status === 204 ? {} : await res.json().catch(() => ({}));
  if (!res.ok) {
    console.warn('mollie_error', method, path, res.status, data && data.title);
    throw new HttpError(502, 'Mollie: ' + ((data && (data.detail || data.title)) || 'onbekende fout'));
  }
  return data;
}
export const money = (n) => ({ currency: 'EUR', value: Number(n).toFixed(2) });
export const mollieMode = () => ((env('MOLLIE_API_KEY') || '').startsWith('live_') ? 'live' : 'test');
export const webhookUrl = () => env('MOLLIE_WEBHOOK_URL', APP_URL() + '/api/mollie-webhook');

// ───────────────────────────── Dates (Europe/Amsterdam) ─────────────────────────────
export function todayAms(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 864e5);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam' }).format(d);   // YYYY-MM-DD
}
export function addMonths(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  t.setUTCDate(Math.min(d, last));
  return t.toISOString().slice(0, 10);
}
export const fmtDate = (iso) => new Date(iso + 'T12:00:00').toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });
export const fmtWhen = (ts) => new Intl.DateTimeFormat('nl-NL', { timeZone: 'Europe/Amsterdam', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(ts));
export const eur = (n) => '€ ' + Number(n).toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Mark a payment as paid and give it an invoice number. Atomic: when two webhook calls race, only one
// "claims" the payment (changed=true) and runs the follow-up; invoice numbers stay without gaps.
export async function markPaid(paymentRow, molliePayment) {
  const at = molliePayment.paidAt || new Date().toISOString();
  const claimed = await one(db().from('payments').update({ status: 'betaald', paid_at: at, method: methodLabel(molliePayment) })
    .eq('id', paymentRow.id).neq('status', 'betaald').select());
  if (!claimed.length) return { row: paymentRow, changed: false };
  let row = claimed[0];
  if (!row.invoice_no) {
    const no = await one(db().rpc('next_invoice_no', { p_at: at }));
    row = await one(db().from('payments').update({ invoice_no: no }).eq('id', row.id).select().single());
  }
  return { row, changed: true };
}
export function methodLabel(p) {
  return { ideal: 'iDEAL', creditcard: 'Creditcard', directdebit: 'SEPA-incasso', bancontact: 'Bancontact' }[p.method] || p.method || '';
}
export function maskIban(iban) {
  if (!iban) return '';
  const s = iban.replace(/\s/g, '');
  return s.slice(0, 4) + ' •••• •••• ' + s.slice(-2);
}
