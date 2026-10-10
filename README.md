# BeautyPass

Beauty-membership platform voor Amsterdam: landingspagina + drie omgevingen (leden, salons, beheer).

- `public/index.html`: landingspagina met wachtlijst (op `/`)
- `src/app/app`: leden-app · `src/app/salon`: salonportaal · `src/app/admin`: beheer
- `supabase/migrations`: database, rollen en rechten (row level security)
- `docs/`: [architectuur](docs/architectuur.md) · [prijsplan](docs/prijsplan.md) · [opzet](docs/opzet.md)

Techniek: Next.js 15 (Vercel) + Supabase (Postgres, Auth). Lokaal: `npm install && npm run dev`.
