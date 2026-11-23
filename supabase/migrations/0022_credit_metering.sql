-- Credit metering. Agent actions (AI test generation, failure investigation,
-- cloud performance/security checks) draw from a monthly pool of credits.
-- Runs in the customer's own CI are never metered.
--
-- consume_credits() checks the balance and writes the debit in one
-- transaction, under a per-org advisory lock, so two parallel requests can't
-- both spend the last credits. Callers refund (kind='refund') if the action
-- then fails. Months are calendar months in UTC.

create or replace function public.credits_used_this_month(p_org uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(case kind when 'debit' then amount when 'refund' then -amount else 0 end), 0)
  from public.usage_ledger
  where org_id = p_org
    and metric = 'credits'
    and created_at >= (date_trunc('month', now() at time zone 'utc') at time zone 'utc');
$$;

create or replace function public.consume_credits(
  p_org uuid,
  p_amount numeric,
  p_limit numeric,
  p_agent text default null,
  p_project uuid default null,
  p_ref text default null
)
returns table (ok boolean, used numeric, ledger_id bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_used numeric;
  v_id bigint;
begin
  if p_amount < 0 then raise exception 'amount must be >= 0'; end if;
  perform pg_advisory_xact_lock(hashtextextended('credits:' || p_org::text, 0));
  v_used := public.credits_used_this_month(p_org);
  if v_used + p_amount > p_limit then
    return query select false, v_used, null::bigint;
    return;
  end if;
  insert into public.usage_ledger (org_id, project_id, metric, amount, agent, kind, ref)
    values (p_org, p_project, 'credits', p_amount, p_agent, 'debit', p_ref)
    returning id into v_id;
  return query select true, v_used + p_amount, v_id;
end;
$$;

-- Only the server (service role) may spend credits. Members can still read
-- their own ledger through the existing RLS policy.
revoke all on function public.consume_credits(uuid, numeric, numeric, text, uuid, text) from public, anon, authenticated;
grant execute on function public.consume_credits(uuid, numeric, numeric, text, uuid, text) to service_role;
revoke all on function public.credits_used_this_month(uuid) from public, anon, authenticated;
grant execute on function public.credits_used_this_month(uuid) to service_role;
