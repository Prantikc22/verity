"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import posthog from "posthog-js";
import { createClient } from "@/lib/supabase/client";
import { FUNNEL_EVENTS } from "@/lib/analytics/events";

export function CreateProjectForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [repo, setRepo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError("");
    const supabase = createClient();
    try {
      const { data: m } = await supabase.from("org_members").select("org_id").limit(1).maybeSingle();
      if (!m) throw new Error("No organization found for your account.");

      const { data: project, error: insErr } = await supabase
        .from("projects")
        .insert({ org_id: m.org_id, name: name.trim(), repo: repo.trim() || null })
        .select("id")
        .single();
      if (insErr) throw new Error(insErr.message);

      if (posthog.__loaded) posthog.capture(FUNNEL_EVENTS.projectCreated, { project_id: project.id });
      setName("");
      setRepo("");
      setOpen(false);
      router.refresh();
      router.push(`/dashboard/projects/${project.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create project.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500">
        + New project
      </button>
    );
  }

  return (
    <form onSubmit={create} className="border border-neutral-200 p-5 dark:border-neutral-800">
      <h3 className="text-sm font-medium">New project</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Project name" autoFocus
          className="border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-neutral-700" />
        <input value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="owner/repo (optional)"
          className="border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-neutral-700" />
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button type="submit" disabled={busy} className="bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
          {busy ? "Creating…" : "Create project"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="border border-neutral-300 px-4 py-2 text-sm dark:border-neutral-700">Cancel</button>
      </div>
    </form>
  );
}
