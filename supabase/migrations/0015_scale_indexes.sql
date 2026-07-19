-- Scale readiness (Supabase performance advisor, 2026-07-18).
--
-- 1. Covering indexes for hot foreign keys. org_members(user_id) is the hottest
--    path in the app — every authed request resolves the org through it.
create index if not exists org_members_user_idx on public.org_members (user_id);
create index if not exists test_runs_org_idx on public.test_runs (org_id);
create index if not exists test_runs_deploy_idx on public.test_runs (deploy_id);
create index if not exists test_results_project_idx on public.test_results (project_id);
create index if not exists tests_org_idx on public.tests (org_id);
create index if not exists perf_reports_org_idx on public.perf_reports (org_id);
create index if not exists security_findings_org_idx on public.security_findings (org_id);
create index if not exists flake_stats_project_idx on public.flake_stats (project_id);
create index if not exists deploys_org_idx on public.deploys (org_id);
create index if not exists healing_events_run_idx on public.healing_events (run_id);
create index if not exists healing_events_test_idx on public.healing_events (test_id);
create index if not exists deploy_confidence_project_idx on public.deploy_confidence (project_id);
create index if not exists explorations_org_idx on public.explorations (org_id);
create index if not exists explorations_test_idx on public.explorations (test_id);
create index if not exists github_installations_org_idx on public.github_installations (org_id);
create index if not exists orgs_created_by_idx on public.orgs (created_by);

-- 2. RLS initplan: wrap auth.uid() in (select …) so it evaluates once per
--    query instead of once per row (advisor: auth_rls_initplan).
drop policy if exists users_self_select on public.users;
create policy users_self_select on public.users
  for select using (id = (select auth.uid()));
drop policy if exists users_self_update on public.users;
create policy users_self_update on public.users
  for update using (id = (select auth.uid()));
drop policy if exists users_self_upsert on public.users;
create policy users_self_upsert on public.users
  for insert with check (id = (select auth.uid()));
drop policy if exists members_self_select on public.org_members;
create policy members_self_select on public.org_members
  for select using (user_id = (select auth.uid()) or is_org_member(org_id));
