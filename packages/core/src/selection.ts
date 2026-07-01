import type { TestMapping } from "./types";

/** Normalize a path for comparison: strip leading "./", collapse slashes. */
function norm(p: string): string {
  return p.replace(/^\.\//, "").replace(/\\/g, "/").replace(/\/+/g, "/").trim();
}

export interface SelectionResult {
  /** Spec paths selected to run in the fast ("Quick check") tier. */
  selected: string[];
  /** Spec paths skipped because no mapped source file intersects the diff. */
  skipped: string[];
  /**
   * Specs that have no source-file mapping at all. These are ALWAYS selected —
   * an unmapped test is treated as potentially-affected, never silently skipped.
   */
  unmapped: string[];
}

/**
 * Diff-aware test selection for the fast tier. Selects only tests whose mapped
 * source files intersect the changed-file set. Tests with no mapping are always
 * selected (fail-safe). This is the "Quick check" subset — it is explicitly NOT
 * a regression guarantee; the full tier exists for that.
 */
export function selectTests(
  mappings: TestMapping[],
  changedFiles: string[],
): SelectionResult {
  const changed = new Set(changedFiles.map(norm));
  const selected: string[] = [];
  const skipped: string[] = [];
  const unmapped: string[] = [];

  for (const m of mappings) {
    const spec = norm(m.specPath);
    const sources = m.sourceFiles.map(norm).filter(Boolean);

    if (sources.length === 0) {
      unmapped.push(spec);
      selected.push(spec);
      continue;
    }

    // Intersect by exact match or directory-prefix containment, so a changed
    // file under a mapped directory still selects the test.
    const hit = sources.some((src) =>
      changed.has(src) ||
      [...changed].some((c) => c === src || c.startsWith(src + "/") || src.startsWith(c + "/")),
    );

    if (hit) selected.push(spec);
    else skipped.push(spec);
  }

  return { selected, skipped, unmapped };
}
