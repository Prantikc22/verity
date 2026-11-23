// Clearpath → QAShift import. Idempotent (keyed on legacy_* ids). One transaction.
import pg from 'pg';
const mk = (u) => new pg.Client({ connectionString: u, ssl: { rejectUnauthorized: false } });
const C = mk(process.env.C), V = mk(process.env.V);
await C.connect(); await V.connect();
const dry = process.argv.includes('--dry');
const log = (...a) => console.log(...a);

const corgs = (await C.query(`select o.id, o.name, lower(u.email) email from orgs o
  join org_members m on m.org_id=o.id and m.role='owner' join users u on u.id=m.user_id`)).rows;
const orgMap = new Map();
for (const o of corgs) {
  const r = await V.query(`select m.org_id from auth.users u join org_members m on m.user_id=u.id
     where lower(u.email)=$1 and m.role='owner' order by m.created_at asc limit 1`, [o.email]);
  if (r.rows[0]) orgMap.set(o.id, r.rows[0].org_id);
}
log('orgs mapped', orgMap.size, 'of', corgs.length);

const cprojects = (await C.query('select * from projects')).rows.filter(p => orgMap.has(p.org_id));
await V.query('begin');
try {
  await V.query('alter table public.projects disable trigger enforce_project_cap_trg');
  for (const [cid, vid] of orgMap) {
    await V.query('update public.orgs set legacy_a11y_org_id=$1 where id=$2 and legacy_a11y_org_id is null', [cid, vid]);
  }
  const projMap = new Map();
  for (const p of cprojects) {
    const vorg = orgMap.get(p.org_id);
    let row = (await V.query('select id from public.projects where legacy_a11y_project_id=$1', [p.id])).rows[0];
    if (!row && p.repo) row = (await V.query('select id from public.projects where org_id=$1 and repo=$2 and legacy_a11y_project_id is null limit 1', [vorg, p.repo])).rows[0];
    if (row) {
      await V.query(`update public.projects set legacy_a11y_project_id=$1, a11y_ingest_token=$2, a11y_fail_on=$3, a11y_scan_urls=$4 where id=$5`,
        [p.id, p.ingest_token, p.fail_on, p.scan_urls ?? [], row.id]);
    } else {
      row = (await V.query(`insert into public.projects (org_id, name, repo, repo_provider, default_branch, visibility, github_installation_id,
          a11y_ingest_token, a11y_fail_on, a11y_scan_urls, legacy_a11y_project_id)
        values ($1,$2,$3,$4,$5,'private',$6,$7,$8,$9,$10) returning id`,
        [vorg, p.name, p.repo, p.repo_provider ?? 'github', p.default_branch ?? 'main', p.github_installation_id, p.ingest_token, p.fail_on, p.scan_urls ?? [], p.id])).rows[0];
    }
    projMap.set(p.id, { id: row.id, org: vorg });
  }
  log('projects mapped', projMap.size);

  const scans = (await C.query('select * from scans where project_id = any($1::uuid[]) order by created_at', [[...projMap.keys()]])).rows;
  const scanMap = new Map();
  for (const s of scans) {
    const pm = projMap.get(s.project_id);
    const r = await V.query(`insert into public.a11y_scans (project_id, org_id, source, url, commit_sha, branch, pr_number, status, score,
        violations_count, passes_count, incomplete_count, impact_critical, impact_serious, impact_moderate, impact_minor, overlay_vendors,
        engine, result, error, legacy_scan_id, created_at)
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
      on conflict (legacy_scan_id) do update set status=excluded.status returning id`,
      [pm.id, pm.org, s.source === 'cloud' ? 'cloud' : 'ci', s.url, s.commit_sha, s.branch, s.pr_number, s.status, s.score,
       s.violations_count, s.passes_count, s.incomplete_count, s.impact_critical, s.impact_serious, s.impact_moderate, s.impact_minor,
       s.overlay_vendors ?? [], s.engine, s.result, s.error, s.id, s.created_at]);
    scanMap.set(s.id, r.rows[0].id);
  }
  log('scans', scanMap.size);

  let ni = 0;
  for (const [cs, vs] of scanMap) {
    const existing = (await V.query('select count(*)::int n from public.a11y_issues where scan_id=$1', [vs])).rows[0].n;
    if (existing) continue;
    for (const i of (await C.query('select * from issues where scan_id=$1', [cs])).rows) {
      await V.query(`insert into public.a11y_issues (scan_id, rule_id, impact, description, help, help_url, wcag_tags, selector, html, node_count, created_at)
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`, [vs, i.rule_id, i.impact, i.description, i.help, i.help_url, i.wcag_tags ?? [], i.selector, i.html, i.node_count, i.created_at]);
      ni++;
    }
  }
  log('issues', ni);

  let nd = 0;
  for (const d of (await C.query('select * from diffs where scan_id = any($1::uuid[])', [[...scanMap.keys()]])).rows) {
    const vs = scanMap.get(d.scan_id);
    if ((await V.query('select 1 from public.a11y_diffs where scan_id=$1', [vs])).rowCount) continue;
    await V.query(`insert into public.a11y_diffs (project_id, branch, scan_id, prev_scan_id, new_count, fixed_count, worsened_count, unchanged_count, new_rules, fixed_rules, worsened_rules, created_at)
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [projMap.get(d.project_id).id, d.branch, vs, d.prev_scan_id ? scanMap.get(d.prev_scan_id) ?? null : null, d.new_count, d.fixed_count, d.worsened_count, d.unchanged_count,
       JSON.stringify(d.new_rules), JSON.stringify(d.fixed_rules), JSON.stringify(d.worsened_rules), d.created_at]);
    nd++;
  }
  log('diffs', nd);

  let ns = 0;
  for (const s of (await C.query('select * from subscriptions')).rows) {
    const vorg = orgMap.get(s.org_id);
    if (!vorg) { log('subscription skipped: org has no owner mapping'); continue; }
    const r = await V.query(`insert into public.legacy_a11y_subscriptions (org_id, provider, provider_subscription_id, plan_tier, status, current_period_end, legacy_subscription_id, created_at)
      values ($1,$2,$3,$4,$5,$6,$7,$8) on conflict (legacy_subscription_id) do nothing`,
      [vorg, s.provider, s.provider_subscription_id, s.plan_tier, s.status, s.current_period_end, s.id, s.created_at]);
    ns += r.rowCount;
  }
  log('legacy subscriptions', ns);

  await V.query('alter table public.projects enable trigger enforce_project_cap_trg');
  if (dry) { await V.query('rollback'); log('DRY RUN rolled back'); } else { await V.query('commit'); log('committed'); }
} catch (e) { await V.query('rollback'); console.error('ROLLED BACK:', e.message); process.exitCode = 1; }
await C.end(); await V.end();
