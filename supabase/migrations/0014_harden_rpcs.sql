-- Security hardening (from Supabase advisor + manual review, 2026-07-18).
--
-- 1. resolve_org_invites trusted caller-supplied (p_user_id, p_email): any
--    authenticated user could pass someone else's invited email and join that
--    org with the invited role (invite theft / org takeover). Identity now
--    comes from the JWT; the args are kept only for signature compatibility
--    and are ignored.
create or replace function public.resolve_org_invites(p_user_id uuid, p_email text)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  uid uuid := auth.uid();
  jwt_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  n int := 0;
begin
  -- NEVER trust the caller's args — derive identity from the session.
  if uid is null or jwt_email = '' then
    return 0;
  end if;

  insert into public.org_members (org_id, user_id, role)
  select i.org_id, uid, i.role
  from public.org_invites i
  where lower(i.email) = jwt_email
  on conflict do nothing;
  get diagnostics n = row_count;

  delete from public.org_invites where lower(email) = jwt_email;
  return n;
end;
$$;

-- 2. Trigger functions are invoked by triggers, never via RPC — remove them
--    from the anon/authenticated API surface entirely.
revoke execute on function public.enforce_project_cap() from anon, authenticated;
revoke execute on function public.handle_new_user() from anon, authenticated;

-- 3. anon has no session, so no RPC here can do anything useful for it —
--    drop anon EXECUTE across the board. authenticated keeps EXECUTE where
--    the app (or RLS policies) call it: is_org_member / is_org_admin /
--    ensure_personal_org / resolve_org_invites.
revoke execute on function public.ensure_personal_org(text) from anon;
revoke execute on function public.resolve_org_invites(uuid, text) from anon;
revoke execute on function public.is_org_member(uuid) from anon;
revoke execute on function public.is_org_admin(uuid) from anon;
