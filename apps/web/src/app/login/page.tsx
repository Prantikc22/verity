import Link from "next/link";
import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";
import { Logo } from "@/components/Logo";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

const AGENTS: [string, string][] = [
  ["Scout", "UI journeys"], ["Relay", "API contracts"], ["Pulse", "Performance"],
  ["Warden", "Security"], ["Lumen", "Accessibility"], ["Prism", "Visual diffs"],
];

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden bg-[#0A0D18] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="relative"><Link href="/" className="text-white"><Logo /></Link></div>

        <div className="relative">
          <h2 className="max-w-md text-4xl font-semibold leading-[1.05] tracking-tight">Find the bugs.<br /><span className="font-serif italic font-normal text-neutral-300">Ship the good stuff.</span></h2>
          <p className="mt-4 max-w-sm text-sm text-slate-400">Six specialist agents, one workspace. Every agent is included in every plan.</p>
          <ul className="mt-8 grid max-w-md grid-cols-2 gap-2">
            {AGENTS.map(([n, r]) => (
              <li key={n} className="rounded-md border border-white/10 px-3 py-2.5">
                <div className="text-sm font-semibold">{n}</div>
                <div className="font-mono text-[11px] text-slate-400">{r}</div>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative text-xs text-slate-500">Your tests stay Playwright code in your repo.</div>
      </aside>

      <div className="flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden"><Link href="/"><Logo /></Link></div>
          <h1 className="text-2xl font-semibold tracking-tight">Welcome to QAShift</h1>
          <p className="mt-1 text-sm text-neutral-500">Create an account or sign in to continue.</p>
          {error && <p className="mt-4 text-sm text-red-600">Sign-in failed. Please try again.</p>}
          <div className="mt-6"><LoginForm next={next} /></div>
        </div>
      </div>
    </main>
  );
}
