-- QAShift 2.0: Lumen (Accessibility Agent) moves into the main workspace.
-- ADDITIVE ONLY. Mirrors the former standalone accessibility product's
-- scans / issues / diffs, scoped to existing QAShift projects and orgs.

-- 1. Per-project accessibility settings ------------------------------------
alter table public.projects
  add column if not exists a11y_ingest_token text unique default encode(gen_random_bytes(24), 'hex'),
  add column if not exists a11y_fail_on text not null default 'new_or_worsened',
  add column if not exists a11y_scan_urls text[] not null default '{}',
  add column if not exists legacy_a11y_project_id uuid unique;

update public.projects set a11y_ingest_token = encode(gen_random_bytes(24), 'hex') where a11y_ingest_token is null;

alter table public.projects drop constraint if exists projects_a11y_fail_on_check;
alter table public.projects add constraint projects_a11y_fail_on_check
  check (a11y_fail_on in ('off','new','new_or_worsened'));

alter table public.orgs add column if not exists legacy_a11y_org_id uuid unique;

-- Keep the accessibility token out of reach of the anon/browser client, like ingest_token (0016).
revoke select (a11y_ingest_token) on public.projects from anon;

-- 2. Scans -----------------------------------------------------------------
create table if not exists public.a11y_scans (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  org_id uuid not null references public.orgs(id) on delete cascade,
  source text not null default 'ci' check (source in ('ci','cloud')),
  url text not null,
  commit_sha text,
  branch text,
  pr_number int,
  status text not null default 'completed' check (status in ('queued','running','completed','failed')),
  score numeric,
  violations_count int not null default 0,
  passes_count int not null default 0,
  incomplete_count int not null default 0,
  impact_critical int not null default 0,
  impact_serious int not null default 0,
  impact_moderate int not null default 0,
  impact_minor int not null default 0,
  overlay_vendors text[] not null default '{}',
  engine text,
  result jsonb,
  error text,
  legacy_scan_id uuid unique,
  created_at timestamptz not null default now()
);
create index if not exists a11y_scans_project_idx on public.a11y_scans (project_id, branch, url, created_at desc);
create index if not exists a11y_scans_org_idx on public.a11y_scans (org_id, created_at desc);

-- 3. Issues ----------------------------------------------------------------
create table if not exists public.a11y_issues (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null references public.a11y_scans(id) on delete cascade,
  rule_id text not null,
  impact text check (impact is null or impact in ('minor','moderate','serious','critical')),
  description text,
  help text,
  help_url text,
  wcag_tags text[] not null default '{}',
  selector text,
  html text,
  node_count int not null default 1,
  created_at timestamptz not null default now()
);
create index if not exists a11y_issues_scan_idx on public.a11y_issues (scan_id);

-- 4. Deploy-over-deploy diffs ---------------------------------------------
create table if not exists public.a11y_diffs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  branch text,
  scan_id uuid not null references public.a11y_scans(id) on delete cascade,
  prev_scan_id uuid references public.a11y_scans(id) on delete set null,
  new_count int not null default 0,
  fixed_count int not null default 0,
  worsened_count int not null default 0,
  unchanged_count int not null default 0,
  new_rules jsonb not null default '[]',
  fixed_rules jsonb not null default '[]',
  worsened_rules jsonb not null default '[]',
  created_at timestamptz not null default now()
);
create index if not exists a11y_diffs_project_idx on public.a11y_diffs (project_id, created_at desc);

-- 5. RLS: members read; only the service role writes ------------------------
alter table public.a11y_scans enable row level security;
alter table public.a11y_issues enable row level security;
alter table public.a11y_diffs enable row level security;

drop policy if exists a11y_scans_member_read on public.a11y_scans;
create policy a11y_scans_member_read on public.a11y_scans for select using (public.is_org_member(org_id));

drop policy if exists a11y_issues_member_read on public.a11y_issues;
create policy a11y_issues_member_read on public.a11y_issues for select using (
  exists (select 1 from public.a11y_scans s where s.id = scan_id and public.is_org_member(s.org_id))
);

drop policy if exists a11y_diffs_member_read on public.a11y_diffs;
create policy a11y_diffs_member_read on public.a11y_diffs for select using (
  exists (select 1 from public.projects p where p.id = project_id and public.is_org_member(p.org_id))
);
