# End-to-end tests (local)

Everything runs against a local Supabase and a stand-in for Mollie and Brevo, so no real keys or payments are involved.

```bash
npx supabase start -x studio,imgproxy,edge-runtime,logflare,vector,supavisor,storage-api,postgres-meta
npx supabase db reset && tests/e2e/seed.sh      # schema + team users (owner/desk/specialist@beautypass-test.nl, password Team-12345) + staff
node scripts/mock-providers.mjs &               # Mollie + Brevo on :4010
cp .env.example .env.development.local          # fill in the local values (see the comments in scripts/mock-providers.mjs)
npx vite --host 0.0.0.0 &                       # the database reaches /api/notify via host.docker.internal
```

Then, with Playwright available:

| Script | Covers |
| --- | --- |
| `onboard.cjs` | account + e-mail code, routine, plan, Mollie checkout, webhook, active member, welcome mail (mobile + desktop) |
| `book.cjs` | booking with real time slots, live in Beheer, confirmation mail |
| `flows.cjs` | cancel, paid single treatment with hold, refund, invoice, failed direct debit → "betaling mislukt", roles |
| `api.mjs` | upgrade/downgrade, pause/resume, new payment method, cancel, cron, waitlist and team invites, permissions |
| `beheer.cjs` | team booking, team notes, team cancel, specialist view, staff drawer |
| `sweep.cjs` | screenshots of every screen (member web + app, Beheer desktop + mobile) |

Screenshots go to `tests/e2e/shots/` (ignored by git).
