-- Why a test needs review. Verification stores the browser's error (trimmed)
-- so the test library can say what went wrong instead of a bare "Needs review".
alter table public.tests
  add column if not exists last_verify_error text,
  add column if not exists last_verified_at timestamptz;
