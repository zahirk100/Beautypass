-- BeautyPass 013: ready-made routines in the onboarding ("Snel kiezen"), editable in Beheer → Instellingen.
-- Run after 012.
alter table settings add column if not exists routine_presets jsonb not null default '[
  {"id": "hands-hair", "name": "Fresh hands & hair", "tagline": "Strak gelakt en een frisse blowout", "treatments": ["gel", "blow"]},
  {"id": "glow", "name": "Glow up", "tagline": "Stralende huid, wenkbrauwen en wimpers", "treatments": ["fexp", "browlam", "lash"]},
  {"id": "full", "name": "Full treatment", "tagline": "Handen, voeten, haar en wimpers in één bezoek", "treatments": ["gel", "pedi", "blow", "lash"]}
]'::jsonb;
grant update (routine_presets) on settings to authenticated;
