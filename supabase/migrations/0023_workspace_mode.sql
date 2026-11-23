-- Workspace mode: which navigation an org sees. One login for everything;
-- 'reports' hides the agent features for teams that only use QAShift Reports
-- (signed up from the Reports page or bought Reports only). It is a display
-- preference, not an entitlement, so org admins may change it freely.
alter table public.orgs
  add column if not exists workspace_mode text not null default 'full';
alter table public.orgs drop constraint if exists orgs_workspace_mode_check;
alter table public.orgs add constraint orgs_workspace_mode_check check (workspace_mode in ('full', 'reports'));
