import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { generateTest } from "@/lib/llm/generate";
import { llmConfig } from "@/lib/llm/provider";
import { checkTestGenRate } from "@/lib/ratelimit";
import { captureServer } from "@/lib/analytics/posthog-server";
import { FUNNEL_EVENTS } from "@/lib/analytics/events";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({
  input: z.string().min(3).max(4000),
  isUrl: z.boolean().optional(),
  baseUrl: z.string().url().optional(),
  prd: z.string().max(6000).optional(),
  needsAuth: z.boolean().optional(),
});

function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "anon"
  );
}

/**
 * Public "try it" test generation. Rate-limited per IP (the LLM call is a cost
 * center). Returns a runnable .spec.ts but does NOT persist — persistence
 * happens through the authed project endpoint.
 */
export async function POST(req: NextRequest) {
  if (!llmConfig().configured) {
    return NextResponse.json(
      { error: "LLM is not configured. Set LLM_API_KEY (and optionally LLM_BASE_URL / LLM_MODEL)." },
      { status: 503 },
    );
  }

  const rate = await checkTestGenRate(clientIp(req));
  if (!rate.success) {
    return NextResponse.json(
      { error: "Rate limit reached for free generations. Sign in for higher limits." },
      { status: 429 },
    );
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Provide { input: string, isUrl?: boolean }." }, { status: 400 });
  }

  const { input, baseUrl, prd, needsAuth } = parsed.data;
  const isUrl = parsed.data.isUrl ?? /^https?:\/\//i.test(input.trim());

  try {
    const gen = await generateTest({ input, isUrl, baseUrl, prd, needsAuth });
    await captureServer(clientIp(req), FUNNEL_EVENTS.testGenerated, {
      isUrl,
      source: "public",
      used_live_context: gen.usedLiveContext,
    });
    return NextResponse.json({
      ok: true,
      plan: gen.plan,
      spec: gen.specContent,
      model: gen.model,
      assertion_count: gen.assertionCount,
      used_live_context: gen.usedLiveContext,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
