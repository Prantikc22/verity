import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/landing/Navbar";
import { McpInstall } from "@/components/landing/McpInstall";
import { Reveal } from "@/components/Reveal";

export const metadata: Metadata = {
  title: "MCP Server — Generate & run tests from your IDE",
  description:
    "Install the Verity MCP server in VS Code, Cursor, Claude Code, or Windsurf. Generate, propose, and run Playwright tests against your localhost — right from your AI coding agent.",
  alternates: { canonical: "https://verity.qashifthq.com/mcp" },
  openGraph: {
    title: "Verity MCP Server",
    description: "Generate, propose, and run tests from your IDE — Cursor, VS Code, Claude Code, Windsurf.",
    type: "website",
    url: "https://verity.qashifthq.com/mcp",
  },
};

export default function McpPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="w-full">
        <div className="mx-auto max-w-4xl px-6 py-16">
          <Reveal>
            <span className="inline-block border border-indigo-300 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300">
              MCP Server
            </span>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
              Generate &amp; run tests from your IDE.
            </h1>
            <p className="mt-4 max-w-2xl text-lg text-neutral-600 dark:text-neutral-300">
              The Verity MCP server plugs into your AI coding agent — Cursor, VS Code, Claude Code, Windsurf — so you can
              generate, propose, and run Playwright tests against your localhost without leaving the editor. One-click install below.
            </p>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="mt-10"><McpInstall /></div>
          </Reveal>

          <Reveal delay={0.15}>
            <div className="mt-12 border-t border-neutral-200 pt-8 dark:border-neutral-800">
              <h2 className="text-xl font-semibold tracking-tight">What it can do</h2>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {[
                  ["Generate tests", "Describe a flow or point it at a URL — it proposes Playwright specs you review."],
                  ["Run on localhost", "Execute tests against your local dev server, right from the agent."],
                  ["Own the code", "Specs land in your repo — Playwright you keep, no lock-in."],
                  ["Same token as CI", "Authenticates with your project token; results roll into your dashboard."],
                ].map(([t, d]) => (
                  <li key={t} className="border border-neutral-200 p-4 dark:border-neutral-800">
                    <div className="font-medium">{t}</div>
                    <div className="mt-1 text-sm text-neutral-500">{d}</div>
                  </li>
                ))}
              </ul>
              <p className="mt-8 text-sm text-neutral-500">
                Need a token? <Link href="/login?next=/dashboard" className="text-indigo-600 underline">Create a free account</Link> and open your project&apos;s Local / MCP tab.
              </p>
            </div>
          </Reveal>
        </div>
      </main>
    </div>
  );
}
