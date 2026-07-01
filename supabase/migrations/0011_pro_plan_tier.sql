-- Add the self-serve "pro" tier ($49/mo · ₹2,999/mo) between free and starter.
-- Marketed as "Self-Serve Pro" (no forward-deployed engineer). Wired into
-- plans.ts (limits) and the Razorpay provider (RAZORPAY_PLAN_PRO).
ALTER TYPE plan_tier ADD VALUE IF NOT EXISTS 'pro' AFTER 'free';
