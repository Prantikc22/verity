-- SECURITY (found in the 2026-07-18 dashboard audit): the projects_public_select
-- RLS policy lets `anon` read PUBLIC project rows for the SEO results pages — but
-- RLS is row-level, so anon also saw the row's `ingest_token`. That token is the
-- ONLY credential /api/ingest checks (Authorization: Bearer <ingest_token>), so a
-- leaked token = anyone can POST forged test runs/perf/findings to that project
-- (dashboard pollution + write cost). No client page reads the token.
--
-- Fix with COLUMN-level privileges: anon may read every project column EXCEPT
-- ingest_token. authenticated keeps full SELECT (members legitimately see the
-- token on the CI Setup page). RLS still governs which ROWS each role sees.
revoke select on public.projects from anon;
grant select (
  id, org_id, name, repo, repo_provider, default_branch,
  github_installation_id, visibility, rerun_count, regression_threshold, created_at
) on public.projects to anon;
