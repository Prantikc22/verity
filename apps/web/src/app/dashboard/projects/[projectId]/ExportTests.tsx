"use client";

import { useState } from "react";

/**
 * Download all of a project's specs as a portable bundle (specs + a POM scaffold
 * + config). This is how an FDE — or you — takes the AI-generated tests out,
 * restructures them into a Page Object Model, and owns them in your own repo.
 */
export function ExportTests({ projectId }: { projectId: string }) {
  const [busy, setBusy] = useState(false);

  async function exportTests() {
    setBusy(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/tests/export`);
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `verity-tests.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button onClick={exportTests} disabled={busy} className="border border-neutral-300 px-3 py-1.5 text-xs font-medium transition hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-900">
      {busy ? "Exporting…" : "⤓ Export tests (for POM / your repo)"}
    </button>
  );
}
