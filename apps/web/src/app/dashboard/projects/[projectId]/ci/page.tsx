import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { IngestToken } from "../IngestToken";
import { CiSetup } from "./CiSetup";

export const metadata: Metadata = { title: "CI Setup", robots: { index: false } };

const APP = process.env.NEXT_PUBLIC_APP_URL ?? "https://verity-kappa-ebon.vercel.app";

export default async function CiSetupPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("ingest_token, default_branch")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) notFound();

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">CI Setup</h2>
        <p className="mt-0.5 text-sm text-neutral-500">
          Choose which tests to run, configure them, and copy a ready-to-paste config for GitHub, GitLab, or Jenkins.
          Everything runs in <strong>your</strong> CI; results post to Verity.
        </p>
      </div>

      {/* The two-tier mental model, visualized. */}
      <section className="border border-neutral-200 p-5 dark:border-neutral-800">
        <h3 className="text-sm font-semibold">How runs are tiered</h3>
        <svg viewBox="0 0 760 150" className="mt-3 w-full" role="img" aria-label="Pull request runs the fast tier; merge runs the full tier.">
          <defs>
            <marker id="ar" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0 0l6 3-6 3z" className="fill-neutral-400" /></marker>
          </defs>
          {/* PR row */}
          <text x="0" y="20" className="fill-neutral-500 text-[11px]">On every Pull Request — Quick / smoke (never blocks)</text>
          <rect x="0" y="30" width="120" height="34" rx="2" className="fill-indigo-50 stroke-indigo-300 dark:fill-indigo-950/40 dark:stroke-indigo-700" strokeWidth="1" />
          <text x="60" y="51" textAnchor="middle" className="fill-indigo-700 text-[11px] font-medium dark:fill-indigo-300">PR opened</text>
          {["UI Quick check", "Perf smoke", "Security baseline", "Code analysis", "Contract"].map((t, i) => (
            <g key={t}>
              <line x1={120 + i * 128} y1="47" x2={148 + i * 128} y2="47" className="stroke-neutral-400" strokeWidth="1" markerEnd="url(#ar)" />
              <rect x={150 + i * 128} y="32" width="110" height="30" rx="2" className="fill-white stroke-neutral-300 dark:fill-neutral-900 dark:stroke-neutral-700" strokeWidth="1" />
              <text x={205 + i * 128} y="51" textAnchor="middle" className="fill-neutral-700 text-[10px] dark:fill-neutral-300">{t}</text>
            </g>
          ))}
          {/* Merge row */}
          <text x="0" y="100" className="fill-neutral-500 text-[11px]">On merge to main — Full (the safety net; only this can block)</text>
          <rect x="0" y="110" width="120" height="34" rx="2" className="fill-amber-50 stroke-amber-300 dark:fill-amber-950/30 dark:stroke-amber-700" strokeWidth="1" />
          <text x="60" y="131" textAnchor="middle" className="fill-amber-700 text-[11px] font-medium dark:fill-amber-300">Merged</text>
          {["Full regression", "Full load test", "Full security scan", "Full code analysis", "Contract"].map((t, i) => (
            <g key={t}>
              <line x1={120 + i * 128} y1="127" x2={148 + i * 128} y2="127" className="stroke-neutral-400" strokeWidth="1" markerEnd="url(#ar)" />
              <rect x={150 + i * 128} y="112" width="110" height="30" rx="2" className="fill-white stroke-neutral-300 dark:fill-neutral-900 dark:stroke-neutral-700" strokeWidth="1" />
              <text x={205 + i * 128} y="131" textAnchor="middle" className="fill-neutral-700 text-[10px] dark:fill-neutral-300">{t}</text>
            </g>
          ))}
        </svg>
      </section>

      {/* Token */}
      <section className="border border-neutral-200 p-5 dark:border-neutral-800">
        <h3 className="text-sm font-semibold">Your ingest token</h3>
        <p className="mt-0.5 text-xs text-neutral-500">Add as <code>VERITY_INGEST_TOKEN</code> in your CI secrets. Ingest endpoint: <code>{APP}/api/ingest</code></p>
        <div className="mt-3"><IngestToken token={project.ingest_token} /></div>
      </section>

      <CiSetup defaultApiUrl={APP} defaultBranch={project.default_branch ?? "main"} />
    </div>
  );
}
