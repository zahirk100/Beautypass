-- BeautyPass 003: storage for demo payments (PAYMENTS_DEMO=1, before there is a Mollie account).
-- Only the server (service role) can read or write it. Can be dropped once real Mollie is connected:
--   drop table demo_mollie;
create table if not exists demo_mollie (
  id text primary key,
  data jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists demo_mollie_customer on demo_mollie ((data->>'customerId'));
alter table demo_mollie enable row level security;
revoke all on demo_mollie from anon, authenticated;
