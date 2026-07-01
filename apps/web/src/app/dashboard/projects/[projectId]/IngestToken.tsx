"use client";

import { useState } from "react";

export function IngestToken({ token }: { token: string }) {
  const [shown, setShown] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <code className="border border-neutral-200 bg-neutral-50 px-3 py-1.5 font-mono text-xs dark:border-neutral-800 dark:bg-neutral-900">
        {shown ? token : "•".repeat(24)}
      </code>
      <button onClick={() => setShown((s) => !s)} className="border border-neutral-300 px-2 py-1 text-xs dark:border-neutral-700">{shown ? "Hide" : "Reveal"}</button>
      <button onClick={copy} className="border border-neutral-300 px-2 py-1 text-xs dark:border-neutral-700">{copied ? "Copied" : "Copy"}</button>
    </div>
  );
}
