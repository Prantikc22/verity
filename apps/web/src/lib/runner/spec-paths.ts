/**
 * The cloud runner writes each test to disk under its spec_path, so paths must
 * be unique, relative `.spec.(c|m)?(j|t)s` files with no traversal (the runner
 * rejects the whole batch otherwise). Saved tests don't guarantee that: the same
 * journey generated twice shares a path. Give every test a safe, unique path
 * for the run; the first copy keeps its original path, later copies get -2, -3.
 */
const VALID = /^[\w./-]+\.spec\.[cm]?[jt]s$/;

function safePath(p: string | null | undefined, fallbackName: string): string {
  const raw = (p ?? "").trim().replace(/\\/g, "/").replace(/^\/+/, "");
  const parts = raw.split("/").filter((s) => s && s !== "." && s !== "..");
  const joined = parts.join("/");
  if (VALID.test(joined)) return joined;
  const slug = (fallbackName || "test").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "test";
  return `tests/${slug}.spec.ts`;
}

export function uniqueRunnerPaths<T extends { spec_path: string; name: string }>(tests: T[]): T[] {
  const used = new Set<string>();
  return tests.map((t) => {
    let path = safePath(t.spec_path, t.name);
    if (used.has(path)) {
      const m = path.match(/^(.*)(\.spec\.[cm]?[jt]s)$/)!;
      let n = 2;
      while (used.has(`${m[1]}-${n}${m[2]}`)) n++;
      path = `${m[1]}-${n}${m[2]}`;
    }
    used.add(path);
    return path === t.spec_path ? t : { ...t, spec_path: path };
  });
}
