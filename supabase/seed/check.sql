-- Quick status check: which parts of the setup have been run?
select
  to_regclass('public.waitlist') is not null                                        as "001 wachtlijst",
  to_regclass('public.salons') is not null                                          as "002 platform",
  exists (select 1 from information_schema.columns
          where table_schema = 'public' and table_name = 'salons' and column_name = 'is_demo') as "003 locaties",
  (select count(*) from auth.users where email like 'demo.%@example.com')            as "demo-accounts",
  (select count(*) from auth.users)                                                 as "alle accounts";
