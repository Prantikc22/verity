"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A small floating "Ask AI" widget for marketing pages. Opens the visitor's
 * preferred AI in a new tab with a prompt pre-filled to summarize the current
 * page. Pure links — no backend, no cost. Providers that support a URL query
 * pre-fill get the prompt; the rest just open.
 */
const PROVIDERS: { name: string; url: (q: string) => string }[] = [
  { name: "ChatGPT", url: (q) => `https://chatgpt.com/?q=${q}` },
  { name: "Claude", url: (q) => `https://claude.ai/new?q=${q}` },
  { name: "Perplexity", url: (q) => `https://www.perplexity.ai/search?q=${q}` },
  { name: "Grok", url: (q) => `https://grok.com/?q=${q}` },
  { name: "Gemini", url: () => `https://gemini.google.com/app` },
];

export function AskAI() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onClick); document.removeEventListener("keydown", onKey); };
  }, [open]);

  function href(p: (typeof PROVIDERS)[number]) {
    const url = typeof window !== "undefined" ? window.location.href : "https://verity.qashifthq.com";
    const prompt = `Summarize this page and tell me what Verity does — the AI-augmented testing platform where AI generates tests, an engineer verifies, and everything runs in your own CI: ${url}`;
    return p.url(encodeURIComponent(prompt));
  }

  return (
    <div ref={ref} className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-2 print:hidden">
      {open && (
        <div className="w-64 border border-neutral-200 bg-background shadow-xl dark:border-neutral-800">
          <div className="border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
            <p className="text-sm font-semibold">Summarize with AI</p>
            <p className="mt-0.5 text-xs text-neutral-500">Opens your AI in a new tab with the page pre-filled.</p>
          </div>
          <ul className="p-1.5">
            {PROVIDERS.map((p) => (
              <li key={p.name}>
                <a
                  href={href(p)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-between px-3 py-2 text-sm text-neutral-700 transition hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-900"
                >
                  <span>{p.name}</span>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" className="text-neutral-400"><path d="M7 17L17 7M9 7h8v8" /></svg>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Summarize this page with AI"
        className="flex items-center gap-2 bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg transition hover:bg-indigo-500"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square"><path d="M12 3l1.9 4.6L18.5 9l-4.6 1.9L12 15l-1.9-4.1L5.5 9l4.6-1.4L12 3z" /></svg>
        Ask AI
      </button>
    </div>
  );
}
