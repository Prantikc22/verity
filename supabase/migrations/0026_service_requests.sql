-- Requests for people-delivered services from inside the app (managed QA
-- diagnostic/enterprise, accessibility audit). Written by the server only;
-- members can read their own org's requests.
create table if not exists public.service_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  user_id uuid,
  email text,
  service text not null check (service in ('managed-diagnostic','managed-enterprise','accessibility-audit')),
  details text,
  status text not null default 'new' check (status in ('new','contacted','closed')),
  created_at timestamptz not null default now()
);
create index if not exists service_requests_org_idx on public.service_requests (org_id, created_at desc);
alter table public.service_requests enable row level security;
drop policy if exists service_requests_member_read on public.service_requests;
create policy service_requests_member_read on public.service_requests for select using (public.is_org_member(org_id));
