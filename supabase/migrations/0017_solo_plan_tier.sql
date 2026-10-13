-- Solo: a $19/mo self-serve tier between Free and Pro (1 project, self-healing,
-- PR checks). Limits live in apps/web/src/lib/plans.ts; checkout uses
-- RAZORPAY_PLAN_SOLO[_USD] and, for annual billing, RAZORPAY_PLAN_<TIER>_YEARLY[_USD].
-- The project-cap trigger (0011_project_cap.sql) already maps unknown tiers to
-- 1 project, which is Solo's cap, so it needs no change.
ALTER TYPE plan_tier ADD VALUE IF NOT EXISTS 'solo' AFTER 'free';
