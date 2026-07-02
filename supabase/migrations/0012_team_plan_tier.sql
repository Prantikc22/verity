-- Add the self-serve "Team" tier ($149/mo · ₹9,999/mo) between pro and starter.
-- Self-serve (no FDE) — a step up from Self-Serve Pro for whole teams.
ALTER TYPE plan_tier ADD VALUE IF NOT EXISTS 'team' AFTER 'pro';
