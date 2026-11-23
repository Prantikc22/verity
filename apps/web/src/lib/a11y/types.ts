/**
 * Canonical Clearpath result contract.
 *
 * Both scan paths converge on these types:
 *   Path A (hosted scanner, our cost)  — produces them from axe-core output.
 *   Path B (CI engine, customer cost)  — the GitHub Action / CLI run axe in the
 *                                        customer's pipeline and POST these to us.
 *
 * Keep this the single source of truth so diffing and reporting never have to
 * care which path a scan came from.
 */

export type Impact = "minor" | "moderate" | "serious" | "critical";

/** Subset of axe-core's NodeResult we persist. */
export interface NormalizedNode {
  selector: string;
  html: string;
  failureSummary?: string;
}

/** One normalized accessibility violation (per axe rule). */
export interface NormalizedIssue {
  ruleId: string;
  impact: Impact | null;
  description: string;
  help: string;
  helpUrl: string;
  wcagTags: string[];
  nodeCount: number;
  nodes: NormalizedNode[];
}

/** Aggregate counters + metadata for a single scan run. */
export interface NormalizedSummary {
  url: string;
  engine: string; // e.g. "axe-core@4.10.2"
  score: number; // 0..100
  violationsCount: number;
  passesCount: number;
  incompleteCount: number;
  impact: Record<Impact, number>;
  overlayVendors: string[]; // discredited overlay scripts detected on the page
  scannedAt: string; // ISO timestamp
}

export interface NormalizedScan {
  summary: NormalizedSummary;
  issues: NormalizedIssue[];
}

/** The minimal shape of an axe-core results object we read from. */
export interface AxeLikeResult {
  testEngine?: { name?: string; version?: string };
  url?: string;
  violations: AxeRule[];
  passes?: AxeRule[];
  incomplete?: AxeRule[];
}

export interface AxeRule {
  id: string;
  impact?: string | null;
  description?: string;
  help?: string;
  helpUrl?: string;
  tags?: string[];
  nodes?: AxeNode[];
}

export interface AxeNode {
  target?: (string | string[])[];
  html?: string;
  failureSummary?: string;
}
