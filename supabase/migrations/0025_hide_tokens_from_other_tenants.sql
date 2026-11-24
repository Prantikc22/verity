-- SECURITY (found in the 2026-11-24 multi-tenancy test): projects_public_select
-- lets ANY signed-in user read PUBLIC project rows, and `authenticated` had
-- table-wide SELECT, so a user from another company could read that project's
-- ingest_token / a11y_ingest_token and post forged runs into it. 0016 only
-- fixed this for anon.
--
-- Fix: `authenticated` may read every projects column EXCEPT the two tokens.
-- Members get their own project's tokens through project_tokens(), which checks
-- membership. Columns added later must be granted explicitly (see the DO block).
revoke select on public.projects from authenticated;
do $$
declare cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into cols
  from information_schema.columns
  where table_schema = 'public' and table_name = 'projects'
    and column_name not in ('ingest_token', 'a11y_ingest_token');
  execute format('grant select (%s) on public.projects to authenticated', cols);
end $$;

create or replace function public.project_tokens(p_project uuid)
returns table (ingest_token text, a11y_ingest_token text)
language sql
stable
security definer
set search_path = public
as $$
  select p.ingest_token::text, p.a11y_ingest_token::text
  from public.projects p
  where p.id = p_project and public.is_org_member(p.org_id);
$$;
revoke all on function public.project_tokens(uuid) from public, anon;
grant execute on function public.project_tokens(uuid) to authenticated, service_role;
