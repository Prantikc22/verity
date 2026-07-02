-- Enforce per-plan project caps at the DATABASE layer.
--
-- Projects are created by a direct client-side insert (RLS-gated by org
-- membership only), so a plan's maxProjects cap cannot be enforced in app code
-- alone — a client could insert past it. This BEFORE INSERT trigger makes the
-- cap unbypassable, whatever the path (browser client OR service role).
--
-- The caps here MUST mirror packages/../apps/web/src/lib/plans.ts (maxProjects).
-- Keep them in sync when plan limits change.

create or replace function public.enforce_project_cap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  org_plan text;
  cap int;
  current_count int;
begin
  select plan::text into org_plan from public.orgs where id = new.org_id;

  cap := case coalesce(org_plan, 'free')
    when 'free'       then 1
    when 'pro'        then 3
    when 'team'       then 10
    when 'starter'    then 3
    when 'growth'     then 10
    when 'scale'      then 50
    when 'enterprise' then 100000
    else 1
  end;

  select count(*) into current_count from public.projects where org_id = new.org_id;

  if current_count >= cap then
    raise exception
      'PROJECT_CAP_REACHED: your % plan allows % project(s). Archive one or upgrade.',
      coalesce(org_plan, 'free'), cap
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_project_cap_trg on public.projects;
create trigger enforce_project_cap_trg
  before insert on public.projects
  for each row execute function public.enforce_project_cap();
