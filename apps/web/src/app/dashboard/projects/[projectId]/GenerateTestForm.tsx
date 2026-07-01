"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PrdUpload } from "./PrdUpload";

export function GenerateTestForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [prd, setPrd] = useState("");
  const [needsAuth, setNeedsAuth] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [sourceFiles, setSourceFiles] = useState("");
  const [critical, setCritical] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ name: string; live: boolean } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim() && description.trim().length < 3) {
      setError("Enter a URL, a description, or both.");
      return;
    }
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/tests`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          url: url.trim() || undefined,
          description: description.trim() || undefined,
          prd: prd.trim() || undefined,
          needsAuth,
          username: username.trim() || undefined,
          password: password.trim() || undefined,
          criticalPath: critical,
          sourceFiles: sourceFiles.split(",").map((s) => s.trim()).filter(Boolean),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed.");
      setUrl(""); setDescription(""); setPrd(""); setNeedsAuth(false); setUsername(""); setPassword(""); setSourceFiles(""); setCritical(false);
      setResult({ name: data.test?.name ?? "Test", live: !!data.used_live_context });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="border border-neutral-200 p-5 dark:border-neutral-800">
      <h3 className="text-sm font-medium">Generate a test</h3>
      <p className="mt-1 text-xs text-neutral-500">
        Give a <strong>URL</strong> and Verity opens the page to find real locators. Add a <strong>flow</strong> and/or a
        <strong> PRD</strong> to make it sharper. The saved test is a Playwright <code>.spec.ts</code> stored in this project.
      </p>

      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://app.example.com/login  (the page to test — opened for real locators)"
        className="mt-3 w-full border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-neutral-700"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={3}
        placeholder="What should the test do? e.g. Log in, add the first product to the cart, and complete checkout."
        className="mt-2 w-full border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-neutral-700"
      />

      <button type="button" onClick={() => setShowAdvanced((s) => !s)} className="mt-2 text-xs text-indigo-600 hover:underline">
        {showAdvanced ? "− Hide" : "+ Add"} PRD, login & mapping
      </button>

      {showAdvanced && (
        <div className="mt-2 space-y-2 border-l-2 border-neutral-200 pl-3 dark:border-neutral-800">
          <textarea
            value={prd}
            onChange={(e) => setPrd(e.target.value)}
            rows={3}
            placeholder="PRD / acceptance criteria (optional) — paste requirements, or upload a doc below."
            className="w-full border border-neutral-300 bg-transparent px-3 py-2 text-xs outline-none focus:border-indigo-500 dark:border-neutral-700"
          />
          <PrdUpload onText={(t) => setPrd((p) => (p ? p + "\n\n" : "") + t)} />

          <div className="grid grid-cols-2 gap-2">
            <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Test username (optional)"
              className="border border-neutral-300 bg-transparent px-3 py-2 text-xs outline-none focus:border-indigo-500 dark:border-neutral-700" />
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Test password (optional)"
              className="border border-neutral-300 bg-transparent px-3 py-2 text-xs outline-none focus:border-indigo-500 dark:border-neutral-700" />
          </div>
          <p className="text-[11px] text-neutral-500">Provide creds and the test uses them directly. Leave blank and Verity uses credentials shown on the page (demo sites) or falls back to <code>TEST_USERNAME</code>/<code>TEST_PASSWORD</code> env vars.</p>

          <input
            value={sourceFiles}
            onChange={(e) => setSourceFiles(e.target.value)}
            placeholder="Source files this test exercises (comma-separated) — powers diff-aware Quick check"
            className="w-full border border-neutral-300 bg-transparent px-3 py-2 text-xs outline-none focus:border-indigo-500 dark:border-neutral-700"
          />
          <label className="flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-300">
            <input type="checkbox" checked={needsAuth} onChange={(e) => setNeedsAuth(e.target.checked)} />
            This flow needs login
          </label>
        </div>
      )}

      <label className="mt-2 flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-300">
        <input type="checkbox" checked={critical} onChange={(e) => setCritical(e.target.checked)} />
        This test covers a critical path (feeds confidence scoring)
      </label>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {result && (
        <p className="mt-2 text-sm text-emerald-600">
          Saved “{result.name}”. {result.live ? "Locators built from the live page ✓" : "Generated from your description."}
        </p>
      )}

      <button type="submit" disabled={busy} className="mt-3 bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
        {busy ? "Opening page & generating…" : "Generate & save"}
      </button>
    </form>
  );
}
