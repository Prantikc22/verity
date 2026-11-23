-- Accessibility subscriptions bought before QAShift 2.0 (separate Razorpay
-- plans). Kept apart from public.subscriptions (one row per org) so an org can
-- hold both, and so the existing billing webhook never overwrites them.
-- Entitlements read these to grandfather accessibility limits.
create table if not exists public.legacy_a11y_subscriptions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  provider text not null default 'razorpay',
  provider_subscription_id text,
  plan_tier text not null check (plan_tier in ('free','starter','growth','scale','enterprise')),
  status text not null,
  current_period_end timestamptz,
  legacy_subscription_id uuid unique,
  created_at timestamptz not null default now()
);
create index if not exists legacy_a11y_subscriptions_org_idx on public.legacy_a11y_subscriptions (org_id);
alter table public.legacy_a11y_subscriptions enable row level security;
drop policy if exists legacy_a11y_subscriptions_member_read on public.legacy_a11y_subscriptions;
create policy legacy_a11y_subscriptions_member_read on public.legacy_a11y_subscriptions for select using (public.is_org_member(org_id));
