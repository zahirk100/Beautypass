// Data layer for the member app, onboarding and Beheer. Replaces the localStorage prototype store
// (bp-store.js) but keeps its shape, so the screens read the same `window.BP` as before:
//   BP.get() / BP.subscribe() / helpers (tr, plan, mem, staff, cat, usedThisMonth, fmtDate, eur …)
// Every change goes through Supabase: rules live in database functions (book_appointment,
// cancel_appointment, team_*), payments and membership changes in /api server functions.
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

// Links from e-mail (invite / password reset) carry their type in the URL; read it before Supabase clears it
const AUTH_LINK = (() => { const h = new URLSearchParams(location.hash.slice(1)); const q = new URLSearchParams(location.search); return h.get('type') || q.get('type') || null; })();

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

const TZ = 'Europe/Amsterdam';
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const addDays = (s, n) => { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return iso(d); };
const localParts = (ts) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(new Date(ts)).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
};
const todayAms = () => localParts(new Date()).date;

const PERMS_ALL = ['dash', 'agenda', 'members', 'plans', 'team', 'waitlist', 'settings', 'finance'];

const empty = () => ({
  v: 1, loaded: false, categories: [], treatments: [], plans: [], team: [], rooms: [], members: [], appointments: [],
  waitlist: [], invoices: [], payments: [], allowances: [],
  settings: { hours: [], cancelHours: 24, noShowCounts: true, rollover: false, mollieMode: 'test', mollieProfile: '', rooms: [], roles: [], users: [] },
  me: null, role: null, perms: [], session: null,
});

let state = empty();
const subs = new Set();
const emit = () => subs.forEach((f) => f(state));
const set = (patch) => { state = { ...state, ...patch }; emit(); };

// ───────────────────────────── Mapping (database → prototype shape) ─────────────────────────────
const mapAppt = (a, rooms) => {
  const { date, time } = localParts(a.starts_at);
  return {
    id: a.id, groupId: a.group_id, primary: a.is_primary, date, time, startsAt: a.starts_at,
    memberId: a.member_id, treatmentId: a.treatment_id, staffId: a.staff_id, roomId: a.room_id,
    room: (rooms.find((r) => r.id === a.room_id) || {}).name || a.room_id,
    status: a.status, note: a.note || '', paid: Number(a.paid_amount) || 0, late: a.late_cancel,
    confirmed: a.confirmed, holdUntil: a.hold_until, checkedInAt: a.checked_in_at || null,
  };
};
const mapMember = (m, teamNotes = {}) => ({
  id: m.id, userId: m.user_id, name: m.name, email: m.email || '', phone: m.phone || '', plan: m.plan_id, nextPlan: m.next_plan_id,
  status: m.status, since: m.since, pausedUntil: m.paused_until, cancelAt: m.cancel_at, nextPayment: m.next_payment_date, checkinCode: m.checkin_code || '',
  mollie: m.mollie_subscription_id || m.mollie_customer_id || '—', mandate: m.mandate_method || '—', mandateLabel: m.mandate_label || '',
  routine: m.routine || [], prefs: m.prefs || {}, notes: m.notes || '', teamNote: teamNotes[m.id] || '',
});
const amsDate = (ts) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam' }).format(new Date(ts));
const mapPayment = (p) => ({
  id: p.invoice_no || p.id, paymentId: p.id, date: amsDate(p.paid_at || p.created_at), amount: Number(p.amount),
  status: p.status, method: p.method || '', kind: p.kind, label: p.description,
});

// ───────────────────────────── Loading ─────────────────────────────
async function q(promise) {
  const { data, error } = await promise;
  if (error) throw new Error(friendly(error));
  return data;
}
export function friendly(error) {
  const msg = (error && (error.message || error.error_description || String(error))) || 'Er ging iets mis';
  if (/JWT|session/i.test(msg)) return 'Je sessie is verlopen. Log opnieuw in.';
  if (/permission denied|row-level security/i.test(msg)) return 'Hiervoor heb je geen rechten.';
  if (/Failed to fetch|NetworkError/i.test(msg)) return 'Geen verbinding. Controleer je internet en probeer het opnieuw.';
  return msg;
}

async function loadCatalog() {
  const [cats, trs, plans, pt, staff, skills, rooms, settings] = await Promise.all([
    q(supabase.from('categories').select('*').order('sort')),
    q(supabase.from('treatments').select('*').order('sort')),
    q(supabase.from('plans').select('*').order('sort')),
    q(supabase.from('plan_treatments').select('*')),
    q(supabase.from('staff').select('id,user_id,name,role_title,color,workdays,active,created_at').order('created_at')),
    q(supabase.from('staff_skills').select('*')),
    q(supabase.from('rooms').select('*').order('sort')),
    q(supabase.from('settings').select('*').eq('id', 1).single()),
  ]);
  const categories = cats.map((c) => ({ id: c.id, name: c.name, title: c.title, it: c.title_it, img: c.img }));
  const treatments = trs.map((t) => ({ id: t.id, cat: t.category_id, name: t.name, dur: t.duration_min, price: Number(t.price), room: t.room, active: t.active }));
  const planList = plans.map((p) => ({ id: p.id, name: p.name, price: Number(p.price), perMonth: p.per_month, interval: '1 month', active: p.active, desc: p.description,
    included: pt.filter((x) => x.plan_id === p.id).map((x) => x.treatment_id) }));
  const team = staff.filter((s) => s.active).map((s) => ({ id: s.id, userId: s.user_id, name: s.name, role: s.role_title, color: s.color,
    days: (s.workdays || []).map((d) => (d ? 1 : 0)), skills: skills.filter((k) => k.staff_id === s.id).map((k) => k.category_id) }));
  set({
    categories, treatments, plans: planList, team, rooms,
    settings: { ...state.settings, hours: settings.hours, cancelHours: settings.cancel_hours, noShowCounts: settings.no_show_counts,
      rollover: settings.rollover, mollieMode: settings.mollie_mode, mollieProfile: settings.mollie_profile || '', rooms: rooms.filter((r) => r.active).map((r) => r.name),
      slotTimes: settings.slot_times, bookingDays: settings.booking_days, pauseMonths: settings.pause_months_per_year },
  });
}

async function loadMemberSelf() {
  const uid = state.session && state.session.user.id;
  const rows = await q(supabase.from('members').select('*').eq('user_id', uid));
  const me = rows[0];
  if (!me) { set({ me: null, members: [] }); return null; }
  const [appts, pays, allow] = await Promise.all([
    q(supabase.from('appointments').select('*').eq('member_id', me.id).order('starts_at')),
    q(supabase.from('payments').select('*').eq('member_id', me.id).order('created_at', { ascending: false })),
    q(supabase.from('allowance_adjustments').select('*').eq('member_id', me.id)),
  ]);
  set({
    me: me.id, members: [mapMember(me)], allowances: allow,
    appointments: appts.filter((a) => a.is_primary).map((a) => mapAppt(a, state.rooms)),
    payments: pays.map((p) => mapPayment(p)), invoices: pays.filter((p) => p.status === 'betaald').map((p) => mapPayment(p)),
  });
  return state.members[0];
}

async function loadTeamData() {
  const can = (p) => state.perms.includes(p);
  const from = addDays(todayAms(), -42), to = addDays(todayAms(), 90);
  const jobs = {
    appts: q(supabase.from('appointments').select('*').gte('starts_at', from).lte('starts_at', to + 'T23:59:59Z').order('starts_at')),
    members: can('members') ? q(supabase.from('members').select('*').order('created_at')) : q(supabase.rpc('agenda_members')),
    notes: can('members') ? q(supabase.from('member_team_notes').select('member_id,body')) : Promise.resolve([]),
    allow: can('members') ? q(supabase.from('allowance_adjustments').select('*')) : Promise.resolve([]),
    waitlist: can('waitlist') ? q(supabase.from('waitlist').select('*').order('created_at', { ascending: false })) : Promise.resolve([]),
    payments: can('finance') ? q(supabase.from('payments').select('*').order('created_at', { ascending: false }).limit(1000)) : Promise.resolve([]),
    users: can('settings') ? q(supabase.from('profiles').select('id,email,name,role').neq('role', 'member').order('created_at')) : Promise.resolve([]),
    roles: q(supabase.from('role_perms').select('*')),
  };
  const r = Object.fromEntries(await Promise.all(Object.entries(jobs).map(async ([k, p]) => [k, await p])));
  const notes = Object.fromEntries(r.notes.map((n) => [n.member_id, n.body]));
  const members = can('members')
    ? r.members.map((m) => mapMember(m, notes))
    : r.members.map((m) => ({ ...mapMember({ id: m.id, name: m.name, plan_id: m.plan_id, status: 'actief', since: null, prefs: { drink: m.drink }, notes: m.notes }), used: m.used, limit: m.month_limit }));
  const order = ['owner', 'manager', 'desk', 'specialist'];
  set({
    appointments: r.appts.map((a) => mapAppt(a, state.rooms)), members, allowances: r.allow,
    waitlist: r.waitlist.map((w) => ({ id: w.id, email: w.email, date: w.created_at.slice(0, 10), source: w.source, interest: w.interest || [], status: w.status, round: w.round })),
    payments: r.payments.map((p) => ({ ...mapPayment(p), memberId: p.member_id })),
    settings: { ...state.settings,
      roles: order.map((id) => r.roles.find((x) => x.role === id)).filter(Boolean).map((x) => ({ id: x.role, name: x.name, perms: x.role === 'owner' ? PERMS_ALL : x.perms })),
      users: r.users.map((u) => ({ id: u.id, name: u.name || u.email.split('@')[0], email: u.email, role: u.role })) },
  });
}

async function loadProfile() {
  const uid = state.session && state.session.user.id;
  if (!uid) { set({ role: null, perms: [] }); return; }
  const prof = await q(supabase.from('profiles').select('role,name,email').eq('id', uid).maybeSingle());
  // A session for an account that no longer exists (deleted in Supabase, or another project): sign out cleanly
  if (!prof) { await supabase.auth.signOut().catch(() => {}); set({ session: null, role: null, perms: [], profile: null }); return; }
  let perms = [];
  if (prof.role === 'owner') perms = PERMS_ALL;
  else if (prof.role !== 'member') perms = ((await q(supabase.from('role_perms').select('perms').eq('role', prof.role).maybeSingle())) || {}).perms || [];
  set({ role: prof.role, perms, profile: prof });
}

// Live updates: the agenda and the member's own list refresh when any appointment changes
let channel = null, reloadTimer = null;
function watchAppointments(reload) {
  if (channel) supabase.removeChannel(channel);
  channel = supabase.channel('appointments')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => {
      clearTimeout(reloadTimer); reloadTimer = setTimeout(() => reload().catch(() => {}), 250);
    }).subscribe();
}

// ───────────────────────────── Boot per environment ─────────────────────────────
// Returns what the entry should show: 'login' | 'onboarding' | 'member' | 'team' | 'no-access'
async function boot(kind) {
  const { data: { session } } = await supabase.auth.getSession();
  set({ session });
  // Payment mode (demo / test / live) for the test notices; not critical, so never blocks the app
  fetch('/api/app-config').then((r) => r.json()).then((c) => set({ paymentsMode: c.payments || null })).catch(() => {});
  await loadCatalog();
  if (!session) { set({ loaded: true }); return kind === 'onboarding' ? 'onboarding' : 'login'; }
  await loadProfile();
  if (!state.session) { set({ loaded: true }); return kind === 'onboarding' ? 'onboarding' : 'login'; }
  if (kind === 'team') {
    if (!state.role || state.role === 'member') { set({ loaded: true }); return 'no-access'; }
    await loadTeamData();
    watchAppointments(loadTeamData);
    set({ loaded: true });
    return 'team';
  }
  const me = await loadMemberSelf();
  set({ loaded: true });
  if (!me || me.status === 'nieuw') return 'onboarding';
  if (kind === 'member') watchAppointments(loadMemberSelf);
  return 'member';
}

supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_OUT') { state = { ...empty(), categories: state.categories, treatments: state.treatments, plans: state.plans, team: state.team, rooms: state.rooms, settings: state.settings }; emit(); }
  else if (session) set({ session });
});

// ───────────────────────────── Server functions (/api) ─────────────────────────────
async function api(path, body) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch('/api/' + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(session ? { Authorization: 'Bearer ' + session.access_token } : {}) },
    body: JSON.stringify(body || {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) throw new Error(data.error || 'Er ging iets mis. Probeer het opnieuw.');
  return data;
}

// ───────────────────────────── Debounced edits (team forms save while typing) ─────────────────────────────
const pending = new Map();
let onError = (msg) => console.error(msg);
function later(key, fn, ms = 600) {
  clearTimeout(pending.get(key));
  pending.set(key, setTimeout(() => { pending.delete(key); fn().catch((e) => onError(friendly(e))); }, ms));
}
const replaceIn = (list, id, patch) => list.map((x) => (x.id === id ? { ...x, ...patch } : x));

// ───────────────────────────── Actions ─────────────────────────────
const auth = {
  signInPassword: async (email, password) => { const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password }); if (error) throw new Error(/Invalid login/i.test(error.message) ? 'E-mailadres of wachtwoord klopt niet' : /not confirmed/i.test(error.message) ? 'Bevestig eerst je e-mailadres via de code in je mail' : friendly(error)); },
  sendCode: async (email, create = false, name = '') => { const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: create, data: name ? { name } : undefined, emailRedirectTo: location.origin + location.pathname } }); if (error) throw new Error(/Signups not allowed|not found/i.test(error.message) ? 'We kennen dit e-mailadres nog niet. Word eerst member.' : friendly(error)); },
  verifyCode: async (email, token, type = 'email') => { const { data, error } = await supabase.auth.verifyOtp({ email: email.trim(), token: token.trim(), type }); if (error) throw new Error(/expired|invalid/i.test(error.message) ? 'Deze code klopt niet of is verlopen' : friendly(error)); set({ session: data.session }); return data.session; },
  signUp: async (email, password, name) => {
    const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { name }, emailRedirectTo: location.origin + '/onboarding' } });
    if (error) throw new Error(/registered|already/i.test(error.message) ? 'Er bestaat al een account met dit e-mailadres. Log in.' : /password/i.test(error.message) ? 'Kies een sterker wachtwoord (minimaal 8 tekens)' : friendly(error));
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) throw new Error('Er bestaat al een account met dit e-mailadres. Log in.');
    if (data.session) set({ session: data.session });
    return { needsCode: !data.session };
  },
  setPassword: async (password) => { const { error } = await supabase.auth.updateUser({ password }); if (error) throw new Error(friendly(error)); },
  resetPassword: async (email, redirect) => { const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: redirect }); if (error) throw new Error(friendly(error)); },
  signOut: async () => { await supabase.auth.signOut(); },
};

const act = {
  // ── member ──
  onboard: async ({ name, phone, routine, plan }) => { await q(supabase.rpc('member_onboard', { p_name: name, p_phone: phone, p_routine: routine, p_plan: plan })); },
  startMembership: async (plan, method) => api('membership-start', { plan, method }),   // → { checkoutUrl }
  book: async ({ tid, date, time, staff, note, reschedule }) => {
    const r = await q(supabase.rpc('book_appointment', { p_treatment: tid, p_date: date, p_time: time, p_staff: staff && staff !== 'any' ? staff : null, p_note: note || '', p_reschedule: reschedule || null }));
    await loadMemberSelf();
    return r;
  },
  payAppointment: async (groupId) => api('appointment-pay', { group_id: groupId }),   // → { checkoutUrl }
  cancel: async (id) => { const r = await q(supabase.rpc('cancel_appointment', { p_appointment: id })); await loadMemberSelf(); return r; },
  // Name, phone, routine, preferences, note. The e-mail address belongs to the membership and is not changed here
  updateMe: (patch) => {
    const { email, ...rest } = patch;
    if (!Object.keys(rest).length) return;
    set({ members: replaceIn(state.members, state.me, rest) });
    const next = state.members.find((m) => m.id === state.me);
    later('me', () => q(supabase.from('members').update({ name: next.name, phone: next.phone || null, routine: next.routine, prefs: next.prefs, notes: next.notes }).eq('id', state.me)));
  },
  membership: async (action, extra = {}) => { const r = await api('membership-change', { action, ...extra }); await loadMemberSelf(); return r; },
  // ── team ──
  setApptStatus: async (id, status) => { await q(supabase.rpc('team_set_appointment_status', { p_appointment: id, p_status: status })); await loadTeamData(); },
  teamBook: async ({ member, tr, date, time, staff, room }) => {
    const r = await q(supabase.rpc('team_book_appointment', { p_member: member, p_treatment: tr, p_date: date, p_time: time, p_staff: staff || null, p_room: room || null }));
    await loadTeamData(); return r;
  },
  slotsFor: async (tid, date, skipGroup, member) => q(supabase.rpc('available_slots', { p_treatment: tid, p_date: date, p_skip_group: skipGroup || null, p_member: member || null })),
  teamNote: (memberId, body) => { set({ members: replaceIn(state.members, memberId, { teamNote: body }) }); later('note' + memberId, () => q(supabase.rpc('team_save_note', { p_member: memberId, p_body: body }))); },
  addAllowance: async (memberId) => { await q(supabase.rpc('team_add_allowance', { p_member: memberId, p_delta: 1, p_reason: 'Coulance' })); await loadTeamData(); },
  memberChange: async (memberId, action, extra = {}) => { const r = await api('membership-change', { member_id: memberId, action, ...extra }); await loadTeamData(); return r; },
  retryPayment: async (memberId) => { const r = await api('membership-change', { member_id: memberId, action: 'retry' }); await loadTeamData(); return r; },
  updatePlan: (id, patch) => {
    set({ plans: replaceIn(state.plans, id, patch) });
    const p = state.plans.find((x) => x.id === id);
    later('plan' + id, () => q(supabase.from('plans').update({ name: p.name, description: p.desc, price: p.price, per_month: p.perMonth, active: p.active }).eq('id', id)));
  },
  addPlan: async () => { const row = await q(supabase.from('plans').insert({ name: 'Nieuw membership', price: 99, per_month: 3, active: false, sort: state.plans.length + 1 }).select().single()); await loadCatalog(); return row.id; },
  togglePlanTreatment: async (pid, tid) => {
    const p = state.plans.find((x) => x.id === pid); const on = p.included.includes(tid);
    set({ plans: replaceIn(state.plans, pid, { included: on ? p.included.filter((x) => x !== tid) : [...p.included, tid] }) });
    await q(on ? supabase.from('plan_treatments').delete().eq('plan_id', pid).eq('treatment_id', tid) : supabase.from('plan_treatments').insert({ plan_id: pid, treatment_id: tid }));
  },
  updateTreatment: (id, patch) => {
    set({ treatments: replaceIn(state.treatments, id, patch) });
    const t = state.treatments.find((x) => x.id === id);
    later('tr' + id, () => q(supabase.from('treatments').update({ name: t.name, category_id: t.cat, duration_min: t.dur, price: t.price, room: t.room }).eq('id', id)));
  },
  addTreatment: async () => { const row = await q(supabase.from('treatments').insert({ category_id: 'nails', name: 'Nieuwe behandeling', duration_min: 45, price: 50, room: 'solo', sort: state.treatments.length + 1 }).select().single()); await loadCatalog(); return row.id; },
  // Treatments with history are switched off instead of deleted, so past appointments keep their name
  removeTreatment: async (id) => {
    const { error } = await supabase.from('treatments').delete().eq('id', id);
    if (error) await q(supabase.from('treatments').update({ active: false }).eq('id', id));
    await loadCatalog();
  },
  updateStaff: (id, patch) => {
    set({ team: replaceIn(state.team, id, patch) });
    const t = state.team.find((x) => x.id === id);
    later('staff' + id, async () => {
      await q(supabase.from('staff').update({ name: t.name, role_title: t.role, color: t.color, workdays: t.days.map(Boolean), user_id: t.userId || null }).eq('id', id));
      // Skills are written as the full set (several quick toggles collapse into one save)
      const del = state.categories.map((c) => c.id).filter((c) => !t.skills.includes(c));
      if (t.skills.length) await q(supabase.from('staff_skills').upsert(t.skills.map((c) => ({ staff_id: id, category_id: c })), { onConflict: 'staff_id,category_id', ignoreDuplicates: true }));
      if (del.length) await q(supabase.from('staff_skills').delete().eq('staff_id', id).in('category_id', del));
    }, 300);
  },
  // Rooms (Instellingen → Ruimtes). Never deleted: appointments keep pointing at them; switching off hides them
  updateRoom: (id, patch) => {
    const rooms = state.rooms.map((r) => (r.id === id ? { ...r, ...patch } : r));
    set({ rooms, settings: { ...state.settings, rooms: rooms.filter((r) => r.active).map((r) => r.name) } });
    const r = rooms.find((x) => x.id === id);
    later('room' + id, async () => {
      if (!r.name.trim()) throw new Error('Geef de ruimte een naam');
      try { await q(supabase.from('rooms').update({ name: r.name.trim(), type: r.type, active: r.active }).eq('id', id)); }
      finally { await loadCatalog(); }
    }, 500);
  },
  addRoom: async () => {
    const n = state.rooms.length + 1;
    await q(supabase.from('rooms').insert({ id: 'ruimte-' + Date.now().toString(36), name: 'Nieuwe ruimte ' + n, type: 'solo', sort: n }));
    await loadCatalog();
  },
  removeStaff: async (id) => { await q(supabase.from('staff').update({ active: false, user_id: null }).eq('id', id)); await loadCatalog(); },
  addStaff: async () => { await q(supabase.from('staff').insert({ name: 'Nieuwe specialist', role_title: 'Specialist' })); await loadCatalog(); },
  inviteWaitlist: async (ids) => { const r = await api('waitlist-invite', { ids }); await loadTeamData(); return r; },
  updateSettings: (patch) => {
    set({ settings: { ...state.settings, ...patch } });
    const s = state.settings;
    later('settings', () => q(supabase.from('settings').update({ hours: s.hours, cancel_hours: s.cancelHours, no_show_counts: s.noShowCounts, rollover: s.rollover, mollie_mode: s.mollieMode }).eq('id', 1)), 300);
  },
  setRolePerms: async (role, perms) => { set({ settings: { ...state.settings, roles: state.settings.roles.map((r) => (r.id === role ? { ...r, perms } : r)) } }); await q(supabase.from('role_perms').update({ perms }).eq('role', role)); },
  setUserRole: async (userId, role) => { await q(supabase.rpc('owner_set_role', { p_user: userId, p_role: role })); await loadTeamData(); },
  inviteStaff: async (email, role) => { const r = await api('team-invite', { email, role }); await loadTeamData(); return r; },
  mollieCheck: () => api('mollie-check'),
  // Check-in with the member pass (Beheer → Check-in)
  checkin: (code) => q(supabase.rpc('team_checkin', { p_code: code })),
  arrive: async (id) => { await q(supabase.rpc('team_checkin_arrive', { p_appointment: id })); await loadTeamData(); },
  newCheckinCode: async () => { await q(supabase.rpc('member_new_checkin_code')); await loadMemberSelf(); },
  demoCharge: async (memberId, outcome) => { await api('demo-charge', { member_id: memberId, outcome }); await loadTeamData(); },
  // The invoice needs the session token, so it is fetched and shown as a blob (the window opens first, or popup blockers step in)
  openInvoice: async (paymentId) => {
    const w = window.open('', '_blank');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/invoice', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(session ? { Authorization: 'Bearer ' + session.access_token } : {}) }, body: JSON.stringify({ id: paymentId }) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Factuur niet gevonden');
      const url = URL.createObjectURL(new Blob([await res.text()], { type: 'text/html' }));
      if (w) w.location.href = url; else location.href = url;
    } catch (e) { if (w) w.close(); throw e; }
  },
};

// ───────────────────────────── Helpers the screens use (same as the prototype) ─────────────────────────────
const usedThisMonth = (mid) => {
  const m = BP.today.slice(0, 7);
  const member = state.members.find((x) => x.id === mid);
  if (member && typeof member.used === 'number') return member.used;   // specialists get it from agenda_members()
  return state.appointments.filter((a) => a.memberId === mid && a.primary !== false && !a.paid && a.date.slice(0, 7) === m
    && (a.status === 'gepland' || a.status === 'afgerond' || (a.status === 'no-show' && state.settings.noShowCounts) || (a.status === 'geannuleerd' && a.late))
    && (a.confirmed !== false || (a.holdUntil && new Date(a.holdUntil) > new Date()))).length;
};
const extraThisMonth = (mid) => {
  const m = BP.today.slice(0, 7) + '-01';
  return state.allowances.filter((x) => x.member_id === mid && x.month === m).reduce((n, x) => n + x.delta, 0);
};
const fallbackPlan = { id: '', name: '—', price: 0, perMonth: 0, included: [], active: false, desc: '' };

const BP = {
  get: () => state, subscribe: (f) => { subs.add(f); return () => subs.delete(f); },
  boot, auth, act, supabase, authLink: AUTH_LINK, onError: (f) => { onError = f; }, showError: (e) => onError(friendly(e)),
  reload: { member: loadMemberSelf, team: loadTeamData, catalog: loadCatalog },
  get today() { return todayAms(); }, addDays, iso,
  get T() { return (state.settings.slotTimes) || ['09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30']; },
  fmtDate: (s, o) => new Date(s + 'T12:00:00').toLocaleDateString('nl-NL', o || { weekday: 'long', day: 'numeric', month: 'long' }),
  eur: (n) => '€ ' + Number(n).toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 2 }),
  tr: (id) => state.treatments.find((t) => t.id === id) || { id, cat: '', name: 'Onbekende behandeling', dur: 0, price: 0, room: 'solo' },
  plan: (id) => state.plans.find((p) => p.id === id) || fallbackPlan,
  mem: (id) => state.members.find((m) => m.id === id) || { id, name: 'Member', email: '', phone: '', plan: '', status: 'actief', routine: [], prefs: {}, notes: '' },
  staff: (id) => state.team.find((t) => t.id === id) || { id, name: 'Specialist', role: '', color: '#b7a48f', skills: [], days: [] },
  cat: (id) => state.categories.find((c) => c.id === id) || { id, name: '', img: '' },
  usedThisMonth, extraThisMonth,
  limitThisMonth: (mid) => BP.plan(BP.mem(mid).plan).perMonth + extraThisMonth(mid),
  can: (p) => state.perms.includes(p),
};
window.BP = BP;
export default BP;
