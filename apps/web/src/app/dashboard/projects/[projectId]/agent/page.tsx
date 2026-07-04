import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { AgentGenerate } from "./AgentGenerate";
import { TestList } from "../TestList";

export const metadata: Metadata = { title: "Agent (AI) testing", robots: { index: false } };

const CATEGORIES: { title: string; blurb: string }[] = [
  { title: "Grounding", blurb: "The model answers from the context it was given and doesn't invent facts, policies, or numbers." },
  { title: "Prompt injection", blurb: "Instructions hidden in user input or retrieved data (“ignore previous…”) are ignored, not obeyed." },
  { title: "Tool use", blurb: "The agent calls the right tool with the right arguments — and doesn't call one it shouldn't." },
  { title: "Safety & PII", blurb: "No harmful output, no leaking of secrets, keys, or personal data into the reply." },
  { title: "Format & schema", blurb: "Structured replies stay valid JSON / match the schema / respect length limits." },
  { title: "Refusal", blurb: "Out-of-scope or disallowed requests are declined cleanly instead of answered." },
];

export default async function AgentPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const supabase = await createClient();
  const [{ data: savedSpecs }, { data: project }] = await Promise.all([
    supabase
      .from("tests")
      .select("*")
      .eq("project_id", projectId)
      .eq("kind", "agent")
      .neq("status", "archived")
      .order("created_at", { ascending: false }),
    supabase.from("projects").select("repo").eq("id", projectId).maybeSingle(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Agent (AI) testing</h2>
          <p className="text-xs text-neutral-500">Evals for your <strong>own</strong> AI features — chatbots, RAG assistants, and tool-using agents. Verity sends adversarial and grounding inputs to your endpoint and asserts a <em>property</em> of the reply, not an exact string.</p>
        </div>
        <span className="shrink-0 border border-amber-400 px-2 py-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400">Early access</span>
      </div>

      <section className="border border-neutral-200 p-5 dark:border-neutral-800">
        <p className="text-sm text-neutral-600 dark:text-neutral-300">
          Point Verity at the HTTP endpoint behind your AI feature. It generates Playwright API evals that run in your CI on every deploy — so a prompt change, a model swap, or a new retrieval source can&apos;t quietly break grounding, safety, or tool-calling. Because output varies, every assertion checks a robust property (a substring, a refusal, valid JSON, an absent secret) rather than a fixed answer.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CATEGORIES.map((c) => (
            <div key={c.title} className="border border-neutral-100 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900">
              <p className="text-sm font-medium text-neutral-700 dark:text-neutral-200">{c.title}</p>
              <p className="mt-1 text-xs text-neutral-500">{c.blurb}</p>
            </div>
          ))}
        </div>
      </section>

      <AgentGenerate projectId={projectId} />

      <section>
        <h3 className="text-sm font-medium text-neutral-500">Saved agent evals ({savedSpecs?.length ?? 0})</h3>
        <TestList
          projectId={projectId}
          repoLinked={Boolean(project?.repo)}
          rows={(savedSpecs ?? []).map((t) => ({
            id: t.id,
            name: t.name,
            spec_path: t.spec_path,
            suite: t.suite ?? null,
            status: t.status,
            critical_path: t.critical_path,
            is_pom: t.is_pom,
            confidenceLabel: "—",
            flakeLabel: "—",
            plan: Array.isArray(t.plan) ? (t.plan as unknown[]).map(String) : [],
            spec_content: t.spec_content,
          }))}
        />
      </section>

      <div className="flex items-center justify-between border border-neutral-200 p-4 text-xs dark:border-neutral-800">
        <p className="text-neutral-500">Prefer we set it up? Your forward-deployed engineer can wire the first evals against your AI endpoint this week.</p>
        <div className="flex shrink-0 items-center gap-2">
          <a href="mailto:hello@qashifthq.com?subject=Agent%20(AI)%20evals" className="border border-indigo-300 px-3 py-1.5 font-medium text-indigo-600 hover:bg-indigo-50 dark:border-indigo-800 dark:hover:bg-indigo-950/30">Talk to us →</a>
          <Link href={`/dashboard/projects/${projectId}/ci`} className="border border-neutral-300 px-3 py-1.5 font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900">CI Setup</Link>
        </div>
      </div>
    </div>
  );
}
