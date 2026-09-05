import {
  GENERATION_SYSTEM,
  HEALING_SYSTEM,
  PROPOSAL_SYSTEM,
  TEST_HEAL_SYSTEM,
  API_PROPOSAL_SYSTEM,
  API_GENERATION_SYSTEM,
  VISUAL_GENERATION_SYSTEM,
  AGENT_PROPOSAL_SYSTEM,
  AGENT_GENERATION_SYSTEM,
  ARTILLERY_GENERATION_SYSTEM,
  K6_GENERATION_SYSTEM,
  buildK6GenerationPrompt,
  buildK6Script,
  type K6GenerateParams,
  type K6Defaults,
  buildGenerationPrompt,
  buildHealingPrompt,
  buildProposalPrompt,
  buildTestHealPrompt,
  buildApiProposalPrompt,
  buildApiGenerationPrompt,
  buildVisualGenerationPrompt,
  buildAgentProposalPrompt,
  buildAgentGenerationPrompt,
  buildArtilleryGenerationPrompt,
  hardenSpec,
  type GenerateTestParams,
  type HealParams,
  type ProposeParams,
  type ApiProposeParams,
  type ApiGenerateParams,
  type VisualGenerateParams,
  type AgentProposeParams,
  type AgentGenerateParams,
  type ArtilleryGenerateParams,
} from "@qashift/verity-core";
import { complete, llmConfig } from "./provider";
import { fetchPageContext } from "./page-context";

/** Strip accidental ``` fences if the model adds them despite instructions. */
function stripFences(s: string): string {
  return s
    .replace(/^```[a-zA-Z]*\n?/, "")
    .replace(/\n?```\s*$/, "")
    .trim();
}

function requireExecutableSpec(code: string, assertion: RegExp, label: string): void {
  if (!/\btest\s*\(/.test(code) || !assertion.test(code)) {
    throw new Error(`${label} generation returned no executable test with the required assertion. Nothing was saved.`);
  }
}

export interface GeneratedTest {
  specContent: string;
  /** Plain-English test plan (mirrors the code steps). */
  plan: string[];
  model: string;
  /** Naive assertion count — feeds confidence scoring downstream. */
  assertionCount: number;
  /** Whether real page context was fetched and used for locators. */
  usedLiveContext: boolean;
}

/**
 * Generate a Playwright test as BOTH a plain-English plan and runnable .spec.ts.
 * When the target is a URL and no pageContext was supplied, this fetches the live
 * page and extracts its interactive elements so locators come from the real DOM.
 */
export async function generateTest(params: GenerateTestParams): Promise<GeneratedTest> {
  let pageContext = params.pageContext;
  const target = params.isUrl ? params.input : params.baseUrl;
  if (!pageContext && target && /^https?:\/\//i.test(target)) {
    const ctx = await fetchPageContext(target, params.credentials);
    if (ctx) pageContext = ctx.summary;
  }

  if (!pageContext) throw new Error("A reachable target URL or captured browser context is required for functional test generation.");
  const raw = await complete({
    system: GENERATION_SYSTEM,
    user: buildGenerationPrompt({ ...params, pageContext }),
    temperature: 0.2,
    json: true,
  });

  let plan: string[] = [];
  let code = "";
  try {
    const parsed = JSON.parse(raw) as { plan?: unknown; code?: unknown };
    if (Array.isArray(parsed.plan)) plan = parsed.plan.map((s) => String(s));
    if (typeof parsed.code === "string") code = parsed.code;
  } catch {
    code = raw; // fall back to raw text if the model didn't return clean JSON
  }
  const specContent = hardenSpec(stripFences(code), pageContext);
  const assertionCount = (specContent.match(/expect\s*\(/g) ?? []).length;
  if (!assertionCount || !/\btest\s*\(/.test(specContent)) throw new Error("Generation returned no executable test with assertions. Nothing was saved.");
  return { specContent, plan, model: llmConfig().model, assertionCount, usedLiveContext: Boolean(pageContext) };
}

export interface HealedTest {
  /** Corrected, hardened .spec.ts. */
  specContent: string;
  /** One plain-English sentence: what was wrong and what changed. */
  explanation: string;
  confidence: number;
  model: string;
}

/**
 * Run-time self-healing of a whole failing spec. Given the spec, the Playwright
 * error, and fresh page context re-fetched from the target URL, the LLM rewrites
 * the spec to fix the real cause without weakening intent. Used by the cloud
 * run-tests pipeline to auto-recover failures and persist the improved spec.
 */
export async function healTest(params: {
  specContent: string;
  error: string;
  baseUrl?: string;
}): Promise<HealedTest> {
  let pageContext: string | undefined;
  if (params.baseUrl && /^https?:\/\//i.test(params.baseUrl)) {
    const ctx = await fetchPageContext(params.baseUrl);
    if (ctx) pageContext = ctx.summary;
  }
  const raw = await complete({
    system: TEST_HEAL_SYSTEM,
    user: buildTestHealPrompt({ specContent: params.specContent, error: params.error, pageContext, baseUrl: params.baseUrl }),
    temperature: 0,
    json: true,
  });
  let code = "";
  let explanation = "";
  let confidence = 0;
  try {
    const parsed = JSON.parse(raw) as { code?: unknown; explanation?: unknown; confidence?: unknown };
    if (typeof parsed.code === "string") code = parsed.code;
    if (typeof parsed.explanation === "string") explanation = parsed.explanation;
    if (typeof parsed.confidence === "number") confidence = parsed.confidence;
  } catch {
    code = raw;
  }
  return {
    specContent: hardenSpec(stripFences(code)),
    explanation: explanation || "Adjusted the test's locators to match the live page.",
    confidence,
    model: llmConfig().model,
  };
}

export interface TestCandidate {
  title: string;
  intent: string;
  priority: "high" | "medium" | "low";
  plan: string[];
}

function normalizedEvidence(s: string): string {
  return s.replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * Drop speculative proposal steps before the user sees them. Quoted UI text must
 * be present in the captured page evidence, and absolute expected URLs must be a
 * captured link target (or the entry URL). Action values such as credentials are
 * allowed because the user/model may intentionally vary them for negative cases.
 */
function groundCandidate(candidate: TestCandidate, pageContext?: string): TestCandidate | null {
  if (!pageContext) return candidate;
  const evidence = normalizedEvidence(pageContext);
  const actionValue = /\b(?:enter|type|fill|input|use|provide)\b/i;
  const groundedPlan: string[] = [];

  for (const step of candidate.plan) {
    let grounded = true;
    if (!actionValue.test(step)) {
      for (const match of step.matchAll(/["“']([^"”']{3,160})["”']/g)) {
        const quoted = normalizedEvidence(match[1]);
        if (quoted && !evidence.includes(quoted)) { grounded = false; break; }
      }
    }
    if (grounded) {
      for (const match of step.matchAll(/https?:\/\/[^\s'"”]+/g)) {
        const expectedUrl = normalizedEvidence(match[0].replace(/[).,;]+$/, ""));
        if (!evidence.includes(expectedUrl)) { grounded = false; break; }
      }
    }
    if (grounded) groundedPlan.push(step);
  }

  // A plan with most of its assertions removed is not trustworthy enough to
  // offer; fewer than two grounded steps also cannot describe a useful test.
  if (groundedPlan.length < 2 || groundedPlan.length < Math.ceil(candidate.plan.length * 0.6)) return null;
  return { ...candidate, plan: groundedPlan };
}

/**
 * Explore a URL (+ optional PRD) and propose a set of tests worth writing.
 * Fetches the live page so proposals are grounded in real elements. Does not
 * generate code or save — the caller lets the user pick which to generate.
 */
export async function proposeTests(
  params: Omit<ProposeParams, "pageContext"> & {
    pageContext?: string;
    credentials?: { username?: string; password?: string };
  },
): Promise<{ candidates: TestCandidate[]; usedLiveContext: boolean }> {
  // If the caller already has context (e.g. the MCP fetched the user's localhost,
  // which our server can't reach), use it. Otherwise fetch server-side.
  let pageContext: string | undefined = params.pageContext;
  if (!pageContext && params.url && /^https?:\/\//i.test(params.url)) {
    const ctx = await fetchPageContext(params.url, params.credentials);
    if (ctx) pageContext = ctx.summary;
  }
  if (!pageContext) throw new Error("A reachable target URL or captured browser context is required before proposing functional tests.");
  const raw = await complete({
    system: PROPOSAL_SYSTEM,
    user: buildProposalPrompt({ ...params, pageContext }),
    temperature: 0.3,
    json: true,
  });
  let candidates: TestCandidate[] = [];
  try {
    const parsed = JSON.parse(raw) as { candidates?: TestCandidate[] };
    if (Array.isArray(parsed.candidates)) {
      candidates = parsed.candidates.slice(0, params.max)
        .map((c) => groundCandidate({
          title: String(c.title ?? "Test"),
          intent: String(c.intent ?? ""),
          priority: (["high", "medium", "low"].includes(c.priority) ? c.priority : "medium") as TestCandidate["priority"],
          plan: Array.isArray(c.plan) ? c.plan.map(String) : [],
        }, pageContext))
        .filter((c): c is TestCandidate => Boolean(c));
    }
  } catch {
    candidates = [];
  }
  return { candidates, usedLiveContext: Boolean(pageContext) };
}

export interface ApiCandidate {
  title: string;
  intent: string;
  method: string;
  path: string;
  category: "happy" | "negative" | "boundary" | "validation" | "auth";
  priority: "high" | "medium" | "low";
  plan: string[];
}

/** Propose API test cases from an OpenAPI spec and/or English requirements. */
export async function proposeApiTests(params: ApiProposeParams): Promise<{ candidates: ApiCandidate[] }> {
  const raw = await complete({
    system: API_PROPOSAL_SYSTEM,
    user: buildApiProposalPrompt(params),
    temperature: 0.3,
    json: true,
  });
  let candidates: ApiCandidate[] = [];
  try {
    const parsed = JSON.parse(raw) as { candidates?: ApiCandidate[] };
    if (Array.isArray(parsed.candidates)) {
      const cats = ["happy", "negative", "boundary", "validation", "auth"];
      candidates = parsed.candidates.slice(0, params.max).map((c) => ({
        title: String(c.title ?? "API test"),
        intent: String(c.intent ?? ""),
        method: String(c.method ?? "").toUpperCase(),
        path: String(c.path ?? ""),
        category: (cats.includes(c.category) ? c.category : "happy") as ApiCandidate["category"],
        priority: (["high", "medium", "low"].includes(c.priority) ? c.priority : "medium") as ApiCandidate["priority"],
        plan: Array.isArray(c.plan) ? c.plan.map(String) : [],
      }));
    }
  } catch {
    candidates = [];
  }
  return { candidates };
}

/** Generate a Playwright API (request-based) test. */
export async function generateApiTest(params: ApiGenerateParams): Promise<GeneratedTest> {
  const raw = await complete({
    system: API_GENERATION_SYSTEM,
    user: buildApiGenerationPrompt(params),
    temperature: 0.2,
    json: true,
  });
  let plan: string[] = [];
  let code = "";
  try {
    const parsed = JSON.parse(raw) as { plan?: unknown; code?: unknown };
    if (Array.isArray(parsed.plan)) plan = parsed.plan.map((s) => String(s));
    if (typeof parsed.code === "string") code = parsed.code;
  } catch {
    code = raw;
  }
  const specContent = stripFences(code);
  const assertionCount = (specContent.match(/expect\s*\(/g) ?? []).length;
  requireExecutableSpec(specContent, /expect\s*\(/, "API");
  return { specContent, plan, model: llmConfig().model, assertionCount, usedLiveContext: false };
}

/* ------------------------------------------------------------------ *
 * Visual (Playwright screenshot regression) — reuses the UI generator  *
 * architecture; emits a .spec.ts whose assertion is toHaveScreenshot.   *
 * ------------------------------------------------------------------ */

/** Generate a Playwright visual-regression spec (snapshot of a stable UI state). */
export async function generateVisualTest(params: VisualGenerateParams): Promise<GeneratedTest> {
  let pageContext = params.pageContext;
  const target = params.isUrl ? params.input : params.baseUrl;
  if (!pageContext && target && /^https?:\/\//i.test(target)) {
    const ctx = await fetchPageContext(target, params.credentials);
    if (ctx) pageContext = ctx.summary;
  }
  if (!pageContext) throw new Error("Live browser context is required for visual test generation.");
  const raw = await complete({
    system: VISUAL_GENERATION_SYSTEM,
    user: buildVisualGenerationPrompt({ ...params, pageContext }),
    temperature: 0.2,
    json: true,
  });
  let plan: string[] = [];
  let code = "";
  try {
    const parsed = JSON.parse(raw) as { plan?: unknown; code?: unknown };
    if (Array.isArray(parsed.plan)) plan = parsed.plan.map((s) => String(s));
    if (typeof parsed.code === "string") code = parsed.code;
  } catch {
    code = raw;
  }
  const specContent = hardenSpec(stripFences(code), pageContext);
  // The screenshot comparison IS the assertion for a visual test.
  const assertionCount = (specContent.match(/toHaveScreenshot\s*\(/g) ?? []).length;
  requireExecutableSpec(specContent, /toHaveScreenshot\s*\(/, "Visual");
  return { specContent, plan, model: llmConfig().model, assertionCount, usedLiveContext: Boolean(pageContext) };
}

/* ------------------------------------------------------------------ *
 * Agent (LLM / AI-feature evals) — Playwright request tests that assert *
 * a PROPERTY of the customer's AI endpoint reply.                       *
 * ------------------------------------------------------------------ */

/** Propose eval cases worth writing for a customer's LLM/agent feature. */
export async function proposeAgentEvals(
  params: AgentProposeParams,
): Promise<{ candidates: TestCandidate[] }> {
  const raw = await complete({
    system: AGENT_PROPOSAL_SYSTEM,
    user: buildAgentProposalPrompt(params),
    temperature: 0.3,
    json: true,
  });
  let candidates: TestCandidate[] = [];
  try {
    const parsed = JSON.parse(raw) as { candidates?: TestCandidate[] };
    if (Array.isArray(parsed.candidates)) {
      candidates = parsed.candidates.slice(0, params.max).map((c) => ({
        title: String(c.title ?? "Eval"),
        intent: String(c.intent ?? ""),
        priority: (["high", "medium", "low"].includes(c.priority) ? c.priority : "medium") as TestCandidate["priority"],
        plan: Array.isArray(c.plan) ? c.plan.map(String) : [],
      }));
    }
  } catch {
    candidates = [];
  }
  return { candidates };
}

/** Generate a Playwright API test that evaluates a property of the AI feature's reply. */
export async function generateAgentEval(params: AgentGenerateParams): Promise<GeneratedTest> {
  const raw = await complete({
    system: AGENT_GENERATION_SYSTEM,
    user: buildAgentGenerationPrompt(params),
    temperature: 0.2,
    json: true,
  });
  let plan: string[] = [];
  let code = "";
  try {
    const parsed = JSON.parse(raw) as { plan?: unknown; code?: unknown };
    if (Array.isArray(parsed.plan)) plan = parsed.plan.map((s) => String(s));
    if (typeof parsed.code === "string") code = parsed.code;
  } catch {
    code = raw;
  }
  const specContent = hardenSpec(stripFences(code));
  const assertionCount = (specContent.match(/expect\s*\(/g) ?? []).length;
  requireExecutableSpec(specContent, /expect\s*\(/, "Agent");
  return { specContent, plan, model: llmConfig().model, assertionCount, usedLiveContext: false };
}

/* ------------------------------------------------------------------ *
 * Performance (Artillery) — generated from the SAME OpenAPI spec.      *
 * ------------------------------------------------------------------ */

/** Generate an Artillery load-test config (YAML) from the OpenAPI spec. */
export async function generateArtilleryScenario(params: ArtilleryGenerateParams): Promise<GeneratedTest> {
  const raw = await complete({
    system: ARTILLERY_GENERATION_SYSTEM,
    user: buildArtilleryGenerationPrompt(params),
    temperature: 0.2,
    json: true,
  });
  let plan: string[] = [];
  let code = "";
  try {
    const parsed = JSON.parse(raw) as { plan?: unknown; code?: unknown };
    if (Array.isArray(parsed.plan)) plan = parsed.plan.map((s) => String(s));
    if (typeof parsed.code === "string") code = parsed.code;
  } catch {
    code = raw;
  }
  const specContent = stripFences(code);
  return { specContent, plan, model: llmConfig().model, assertionCount: 0, usedLiveContext: false };
}

/* ------------------------------------------------------------------ *
 * Performance (k6) — one script, every profile. The AI writes only the *
 * scenario body; buildK6Script wraps it with the deterministic load    *
 * shapes + thresholds. Generated from the SAME OpenAPI spec.           *
 * ------------------------------------------------------------------ */

/** Generate a single k6 script (all profiles) from the OpenAPI spec. */
export async function generateK6Script(
  params: K6GenerateParams & { defaults?: K6Defaults },
): Promise<GeneratedTest> {
  let plan: string[] = [];
  let scenarioBody = "";
  try {
    const raw = await complete({
      system: K6_GENERATION_SYSTEM,
      user: buildK6GenerationPrompt(params),
      temperature: 0.2,
      json: true,
    });
    const parsed = JSON.parse(raw) as { plan?: unknown; code?: unknown };
    if (Array.isArray(parsed.plan)) plan = parsed.plan.map((s) => String(s));
    if (typeof parsed.code === "string") scenarioBody = stripFences(parsed.code);
  } catch {
    throw new Error("Performance generation failed. No substitute scenario was saved.");
  }
  if (!scenarioBody) throw new Error("Performance generation returned an empty scenario.");
  const specContent = buildK6Script({ baseUrl: params.baseUrl ?? "", scenarioBody, defaults: params.defaults });
  return { specContent, plan, model: llmConfig().model, assertionCount: 0, usedLiveContext: false };
}

export interface HealSuggestion {
  selector: string;
  confidence: number;
  rationale: string;
  model: string;
}

/**
 * Self-healing: given a broken selector + DOM snapshot, propose a corrected
 * locator. This NEVER writes back into source — the caller surfaces it as a
 * suggested diff for human review.
 */
export async function healSelector(params: HealParams): Promise<HealSuggestion> {
  const raw = await complete({
    system: HEALING_SYSTEM,
    user: buildHealingPrompt(params),
    temperature: 0,
    json: true,
  });
  let parsed: { selector?: string; confidence?: number; rationale?: string } = {};
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = {};
  }
  return {
    selector: parsed.selector ?? "",
    confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0,
    rationale: parsed.rationale ?? "",
    model: llmConfig().model,
  };
}
