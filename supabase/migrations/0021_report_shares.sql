-- Shareable, expiring, read-only report links (QAShift Reports).
-- A share is scoped to one org (optionally one project) and a fixed window.
-- The public page reads through the service role using the unguessable token,
-- so anonymous users never get table access.
create table if not exists public.report_shares (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  token text not null unique,
  days int not null default 14 check (days between 1 and 90),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists report_shares_org_idx on public.report_shares (org_id, created_at desc);
alter table public.report_shares enable row level security;
drop policy if exists report_shares_member_read on public.report_shares;
create policy report_shares_member_read on public.report_shares for select using (public.is_org_member(org_id));
