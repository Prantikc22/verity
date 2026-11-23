-- QAShift 2.0: unified entitlements (ADDITIVE ONLY — safe to apply before any
-- app code reads these columns; nothing existing is dropped or renamed).
--
-- Model
--   orgs.plan (plan_tier)      → unchanged. Still written by the Razorpay
--                                webhook for every legacy subscription.
--   orgs.legacy_plan           → snapshot of orgs.plan at migration time.
--   orgs.grandfathered         → true for every org that existed before 2.0.
--                                Entitlements = MORE generous of legacy vs new,
--                                so no existing customer loses anything.
--   orgs.autonomous_plan       → new self-serve plan key (free|builder|growth|scale)
--   orgs.reports_plan          → standalone Reports plan (reports-free|reports-plus|reports-team)
--   orgs.managed_plan          → managed QA plan (assist|launch|growth|scale|enterprise)
--   subscriptions.product/plan_key → which product a subscription pays for.
--   usage_ledger               → metering for credits, results, artifact bytes, cloud minutes.
--
-- Limits for the plan keys live in apps/web/src/lib/catalog.ts (the typed
-- source); enforce_project_cap() below mirrors only the project caps.

-- 1. orgs ---------------------------------------------------------------
alter table public.orgs
  add column if not exists legacy_plan public.plan_tier,
  add column if not exists grandfathered boolean not null default false,
  add column if not exists autonomous_plan text,
  add column if not exists reports_plan text,
  add column if not exists managed_plan text;

alter table public.orgs drop constraint if exists orgs_autonomous_plan_check;
alter table public.orgs add constraint orgs_autonomous_plan_check
  check (autonomous_plan is null or autonomous_plan in ('free','builder','growth','scale'));
alter table public.orgs drop constraint if exists orgs_reports_plan_check;
alter table public.orgs add constraint orgs_reports_plan_check
  check (reports_plan is null or reports_plan in ('reports-free','reports-plus','reports-team'));
alter table public.orgs drop constraint if exists orgs_managed_plan_check;
alter table public.orgs add constraint orgs_managed_plan_check
  check (managed_plan is null or managed_plan in ('assist','launch','growth','scale','enterprise'));

-- Grandfather every existing org exactly once (idempotent: only rows not yet snapshotted).
update public.orgs
   set legacy_plan = plan,
       grandfathered = true
 where legacy_plan is null;

-- Plan columns are written by the server (webhooks / admin) only. Members can
-- already UPDATE orgs via existing RLS for the name, so block plan edits from
-- non-service roles with a trigger rather than loosening/tightening policies.
create or replace function public.guard_org_plan_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), 'service_role') <> 'service_role' and (
       new.plan is distinct from old.plan
    or new.legacy_plan is distinct from old.legacy_plan
    or new.grandfathered is distinct from old.grandfathered
    or new.autonomous_plan is distinct from old.autonomous_plan
    or new.reports_plan is distinct from old.reports_plan
    or new.managed_plan is distinct from old.managed_plan) then
    raise exception 'PLAN_COLUMNS_READ_ONLY' using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_org_plan_columns_trg on public.orgs;
create trigger guard_org_plan_columns_trg
  before update on public.orgs
  for each row execute function public.guard_org_plan_columns();

-- 2. subscriptions --------------------------------------------------------
alter table public.subscriptions
  add column if not exists product text not null default 'legacy',
  add column if not exists plan_key text;

alter table public.subscriptions drop constraint if exists subscriptions_product_check;
alter table public.subscriptions add constraint subscriptions_product_check
  check (product in ('legacy','autonomous','reports','managed','accessibility_legacy'));

-- 3. usage ledger ---------------------------------------------------------
create table if not exists public.usage_ledger (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.orgs(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  metric text not null check (metric in ('credits','results','artifact_bytes','cloud_minutes')),
  amount numeric not null check (amount >= 0),
  agent text check (agent is null or agent in ('ui','api','performance','security','accessibility','visual','investigator')),
  -- 'estimate' rows are shown before a run; 'debit' rows count against the plan.
  kind text not null default 'debit' check (kind in ('estimate','debit','refund')),
  ref text,
  created_at timestamptz not null default now()
);
create index if not exists usage_ledger_org_month_idx on public.usage_ledger (org_id, metric, created_at desc);
alter table public.usage_ledger enable row level security;

drop policy if exists usage_ledger_member_read on public.usage_ledger;
create policy usage_ledger_member_read on public.usage_ledger
  for select using (public.is_org_member(org_id));
-- No insert/update/delete policies: only the service role writes the ledger.

-- 4. project cap: the more generous of legacy and new plans ---------------
create or replace function public.enforce_project_cap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  o record;
  legacy_cap int;
  auto_cap int;
  reports_cap int;
  managed_cap int;
  cap int;
  current_count int;
begin
  select plan::text as plan, autonomous_plan, reports_plan, managed_plan
    into o from public.orgs where id = new.org_id;

  legacy_cap := case coalesce(o.plan, 'free')
    when 'free'       then 1
    when 'solo'       then 1
    when 'pro'        then 3
    when 'team'       then 10
    when 'starter'    then 3
    when 'growth'     then 10
    when 'scale'      then 50
    when 'enterprise' then 100000
    else 1
  end;
  auto_cap := case o.autonomous_plan
    when 'free' then 1 when 'builder' then 2 when 'growth' then 5 when 'scale' then 20 else 0 end;
  reports_cap := case o.reports_plan
    when 'reports-free' then 1 when 'reports-plus' then 5 when 'reports-team' then 20 else 0 end;
  managed_cap := case o.managed_plan
    when 'assist' then 5 when 'launch' then 5 when 'growth' then 20 when 'scale' then 20 when 'enterprise' then 100000 else 0 end;

  cap := greatest(legacy_cap, auto_cap, reports_cap, managed_cap);

  select count(*) into current_count from public.projects where org_id = new.org_id;
  if current_count >= cap then
    raise exception
      'PROJECT_CAP_REACHED: your plan allows % project(s). Archive one or upgrade.', cap
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
