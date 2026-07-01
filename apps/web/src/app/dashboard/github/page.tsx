import type { Metadata } from "next";
import Link from "next/link";
import { getPrimaryOrg } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { GithubInstallVisual } from "@/components/GithubInstallVisual";

export const metadata: Metadata = { title: "GitHub App", robots: { index: false } };

const INSTALL_URL = "https://github.com/apps/verity-by-qashift/installations/new";
const CONFIGURE_URL = "https://github.com/apps/verity-by-qashift";

export default async function GithubAppPage() {
  const orgCtx = await getPrimaryOrg();
  const supabase = await createClient();

  const { data: installs } = orgCtx?.org.id
    ? await supabase
        .from("github_installations")
        .select("id, account_login, account_type, installation_id, suspended, created_at")
        .eq("org_id", orgCtx.org.id)
        .order("created_at", { ascending: false })
    : { data: [] };

  const connected = (installs ?? []).filter((i) => !i.suspended);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">GitHub App</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Connect your repositories so Verity runs your tests on every pull request — exploratory and regression — and
          comments the results, predictions, and self-healing diffs.
        </p>
      </div>

      <section className="border border-neutral-200 p-5 dark:border-neutral-800">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium">Connect with GitHub</h2>
            <p className="mt-1 text-xs text-neutral-500">Install <strong>Verity by QAShift</strong> and pick the repos to cover.</p>
          </div>
          <a href={INSTALL_URL} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-2 bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900">
            <GithubMark className="h-4 w-4" /> {connected.length ? "Add or manage repos" : "Connect with GitHub App"}
          </a>
        </div>
        <div className="mt-5 border-t border-neutral-100 pt-5 text-neutral-700 dark:border-neutral-800 dark:text-neutral-300">
          <GithubInstallVisual className="mx-auto w-full max-w-2xl" />
        </div>
      </section>

      <section>
        <h2 className="text-sm font-medium text-neutral-500">Installations ({connected.length})</h2>
        {connected.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-500">No installations yet. Use the button above to install the app on an org or your account.</p>
        ) : (
          <ul className="mt-2 divide-y divide-neutral-100 border-y border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
            {(installs ?? []).map((i) => (
              <li key={i.id} className="flex items-center justify-between py-3 text-sm">
                <span className="flex items-center gap-2">
                  <GithubMark className="h-4 w-4 text-neutral-500" />
                  <span className="font-medium">{i.account_login}</span>
                  <span className="text-xs text-neutral-400">{i.account_type ?? "account"}</span>
                  {i.suspended && <span className="bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-950 dark:text-red-300">suspended</span>}
                </span>
                <a href={CONFIGURE_URL} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 underline">Configure</a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-xs text-neutral-500">
        Looking for the public overview? See the <Link href="/github" className="text-indigo-600 underline">GitHub App page</Link>.
      </p>
    </div>
  );
}

function GithubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className={className} aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}
