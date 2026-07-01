-- Verity — multi-discipline testing (mobile / performance / security + API contract).
-- ADDITIVE ONLY. Safe to run on the live DB: new columns are nullable/defaulted
-- so existing UI/API ingestion keeps working with zero changes. New tables are
-- org-scoped with RLS mirroring the existing domain tables.
--
-- Apply with the Supabase MCP (apply_migration) or `supabase db push`.

begin;

-- 1. test_results: discipline metadata (defaults preserve existing UI/API rows).
alter table public.test_results
  add column if not exists discipline text not null default 'ui',
  add column if not exists engine text,
  add column if not exists layer text,            -- 'flow' | 'contract' (API only)
  add column if not exists endpoint text,         -- e.g. 'POST /users'
  add column if not exists meaning text;          -- cross-layer dedup bucket

create index if not exists test_results_discipline_idx on public.test_results (discipline);
create index if not exists test_results_endpoint_idx on public.test_results (endpoint);

-- 2. test_runs: run-level discipline (so run history can be filtered per discipline).
alter table public.test_runs
  add column if not exists discipline text not null default 'ui';

create index if not exists test_runs_discipline_idx on public.test_runs (project_id, discipline);

-- 3. tests: reuse the existing `kind` column for discipline. It already exists as
--    text default 'ui' with 'ui'|'api'; mobile/performance flows store
--    kind='mobile'|'performance'. No schema change required — documented here.

-- 4. security_findings — DAST (ZAP) + SAST (Semgrep). Issues, not pass/fail tests.
create table if not exists public.security_findings (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.test_runs (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  org_id uuid not null references public.orgs (id) on delete cascade,
  engine text not null,                 -- 'zap' | 'semgrep'
  rule_id text not null,
  title text not null,
  severity text not null,               -- 'critical'|'high'|'medium'|'low'|'info'
  message text,
  file_path text,                       -- SAST
  line int,                             -- SAST
  url text,                             -- DAST
  cwe text,
  count int not null default 1,
  created_at timestamptz not null default now()
);
create index if not exists security_findings_run_idx on public.security_findings (run_id);
create index if not exists security_findings_project_idx on public.security_findings (project_id, severity);

-- 5. perf_reports — Artillery load + Lighthouse Core Web Vitals.
create table if not exists public.perf_reports (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.test_runs (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  org_id uuid not null references public.orgs (id) on delete cascade,
  engine text not null,                 -- 'artillery' | 'lighthouse'
  tier text not null,                   -- 'fast' (smoke) | 'full' (load)
  aggregate jsonb not null,             -- PerfMetrics
  scenarios jsonb,                      -- per-scenario PerfMetrics[]
  web_vitals jsonb,                     -- Lighthouse CWV
  created_at timestamptz not null default now()
);
create index if not exists perf_reports_run_idx on public.perf_reports (run_id);
create index if not exists perf_reports_project_idx on public.perf_reports (project_id, created_at desc);

-- 6. RLS — org members can read; writes happen via the service-role ingest path
--    (which bypasses RLS), mirroring how test_results is populated.
alter table public.security_findings enable row level security;
alter table public.perf_reports enable row level security;

drop policy if exists security_findings_select on public.security_findings;
create policy security_findings_select on public.security_findings
  for select using (public.is_org_member(org_id));

drop policy if exists perf_reports_select on public.perf_reports;
create policy perf_reports_select on public.perf_reports
  for select using (public.is_org_member(org_id));

commit;
