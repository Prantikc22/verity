-- tests.kind was constrained to ('ui','api'), which silently broke saving specs
-- for every other discipline: performance configs (kind='performance') and the
-- visual + agent disciplines added in 2026-07. Widen the CHECK to all disciplines
-- that persist generated specs. (Security persists findings, not specs; mobile
-- was removed as an AI discipline.)
alter table public.tests drop constraint if exists tests_kind_check;
alter table public.tests add constraint tests_kind_check
  check (kind = any (array['ui'::text, 'api'::text, 'performance'::text, 'visual'::text, 'agent'::text]));
