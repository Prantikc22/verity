import Link from "next/link";
import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";
import { Logo } from "@/components/Logo";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

const POINTS = [
  "AI-generated Playwright tests from a sentence or URL",
  "Self-healing locators — surfaced as diffs, never auto-merged",
  "Flake vs. real-failure triage right in your pull requests",
  "Runs in your own CI — we never host your browsers",
];

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden bg-neutral-950 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <svg className="absolute inset-0 h-full w-full opacity-[0.08]" aria-hidden>
          <defs>
            <pattern id="lgrid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M40 0H0V40" fill="none" stroke="white" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#lgrid)" />
        </svg>
        <div className="absolute right-[-60px] top-[-60px] h-64 w-64 rotate-45 border border-indigo-500/30" />
        <div className="absolute bottom-10 left-[-40px] h-40 w-40 bg-indigo-500/10" />

        <div className="relative">
          <Link href="/" className="inline-flex items-center gap-2 text-lg font-semibold">
            <span className="flex h-8 w-8 items-center justify-center bg-indigo-600">
              <svg width="18" height="18" viewBox="0 0 32 32" fill="none" aria-hidden><path d="M6 9 L16 24 L26 9" stroke="#fff" strokeWidth="3.2" strokeLinecap="square" strokeLinejoin="miter" /></svg>
            </span>
            Verity
          </Link>
        </div>

        <div className="relative">
          <h2 className="max-w-sm text-3xl font-semibold leading-tight tracking-tight">Tests that write themselves. And heal themselves.</h2>
          <ul className="mt-8 space-y-3">
            {POINTS.map((p) => (
              <li key={p} className="flex items-start gap-3 text-sm text-neutral-300">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0 text-indigo-400"><path d="M20 6L9 17l-5-5" /></svg>
                {p}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative text-xs text-neutral-500">Part of the QAShift testing platform.</div>
      </aside>

      <div className="flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden"><Link href="/"><Logo /></Link></div>
          <h1 className="text-2xl font-semibold tracking-tight">Welcome to Verity</h1>
          <p className="mt-1 text-sm text-neutral-500">Create an account or sign in to continue.</p>
          {error && <p className="mt-4 text-sm text-red-600">Sign-in failed. Please try again.</p>}
          <div className="mt-6"><LoginForm next={next} /></div>
        </div>
      </div>
    </main>
  );
}
