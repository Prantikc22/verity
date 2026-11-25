/** Applies Test Runs filters from the URL to a test_runs query. Shared by org and project run lists. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyRunFilters<Q extends { [k: string]: any }>(query: Q, sp: Record<string, string | string[] | undefined>): Q {
  const one = (k: string) => { const v = sp[k]; return (Array.isArray(v) ? v[0] : v)?.trim() ?? ""; };
  let q = query;
  switch (one("result")) {
    case "failed": q = q.gt("failed", 0); break;
    case "flaky": q = q.eq("failed", 0).gt("flaky", 0); break;
    case "passed": q = q.eq("failed", 0).eq("flaky", 0).eq("status", "completed"); break;
    case "running": q = q.in("status", ["queued", "running"]); break;
  }
  switch (one("source")) {
    case "cloud": q = q.in("branch", ["cloud", "cloud-trial"]); break;
    case "local": q = q.eq("trigger", "manual").not("branch", "in", "(cloud,cloud-trial)"); break;
    case "ci": q = q.neq("trigger", "manual"); break;
  }
  const agent = one("agent");
  if (agent === "api") q = q.in("discipline", ["api", "contract"]);
  else if (agent === "ui") q = q.in("discipline", ["ui", "agent"]);
  else if (["performance", "security", "accessibility", "visual"].includes(agent)) q = q.eq("discipline", agent);
  const days = Number(one("range"));
  if (days > 0) q = q.gte("created_at", new Date(Date.now() - days * 86_400_000).toISOString());
  const project = one("project");
  if (/^[0-9a-f-]{36}$/i.test(project)) q = q.eq("project_id", project);
  const text = one("q").replace(/[^\w./#-]/g, "").slice(0, 80);
  if (text) {
    const pr = text.replace(/^#/, "");
    q = /^\d+$/.test(pr) ? q.or(`pr_number.eq.${pr},commit_sha.ilike.${pr}%`) : q.or(`branch.ilike.%${text}%,commit_sha.ilike.${text}%`);
  }
  return q;
}
