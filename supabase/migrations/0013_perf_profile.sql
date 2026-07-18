-- Perf profile (k6): which load SHAPE produced the report
-- (smoke|load|stress|spike|soak|breakpoint). Nullable + additive — existing
-- Artillery/Lighthouse rows keep NULL and render exactly as before.
alter table public.perf_reports add column if not exists profile text;
comment on column public.perf_reports.profile is 'k6 load profile: smoke|load|stress|spike|soak|breakpoint (null for artillery/lighthouse)';
