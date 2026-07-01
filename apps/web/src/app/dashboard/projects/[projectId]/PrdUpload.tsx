"use client";

import { useState } from "react";

/** Upload a PRD doc (txt/md/pdf/docx) → extracts text and hands it to onText. */
export function PrdUpload({ onText }: { onText: (text: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [err, setErr] = useState("");

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true); setErr(""); setName(file.name);
    try {
      const lower = file.name.toLowerCase();
      if (lower.endsWith(".txt") || lower.endsWith(".md") || lower.endsWith(".csv") || lower.endsWith(".json")) {
        onText((await file.text()).slice(0, 12000));
      } else {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/extract-doc", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Couldn't read the document.");
        onText(data.text);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="text-xs">
      <label className="inline-flex cursor-pointer items-center gap-2 border border-neutral-300 px-3 py-1.5 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900">
        ⤓ Upload PRD (pdf, docx, txt, md)
        <input type="file" accept=".pdf,.docx,.txt,.md,.csv,.json" onChange={onFile} className="hidden" />
      </label>
      {busy && <span className="ml-2 text-neutral-500">reading {name}…</span>}
      {!busy && name && !err && <span className="ml-2 text-emerald-600">✓ {name} loaded into PRD</span>}
      {err && <span className="ml-2 text-red-600">{err}</span>}
    </div>
  );
}
