-- Richer reports: where a test lives, what each attempt did, and run context.
-- All optional and additive; older reporters keep working unchanged.
alter table public.test_results
  add column if not exists location text,          -- "tests/checkout.spec.ts:42"
  add column if not exists details jsonb;          -- { attempts:[{ok,ms,error,step}], stack, step, tags, project }
alter table public.test_runs
  add column if not exists meta jsonb;             -- { ci_url, commit_message, author, repo, playwright, workers, os, wall_ms }
create index if not exists test_results_history_idx on public.test_results (project_id, spec_path, name, created_at desc);
