"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * A small floating "Ask AI" widget for marketing pages. Opens the visitor's
 * preferred AI in a new tab with a prompt pre-filled to summarize the current
 * page. Pure links — no backend, no cost. Brand logos are inline SVGs (no
 * external deps); the provider name is the hover title for accessibility.
 */

// Brand marks — recognizable, brand-coloured, self-contained.
const Logos: Record<string, ReactNode> = {
  ChatGPT: (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path d="M12 2.6l7.5 4.33v8.66L12 19.92 4.5 15.6V6.93z" fill="none" stroke="#10A37F" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M8.2 9.1l3.8 2.2 3.8-2.2M12 11.3v4.6" fill="none" stroke="#10A37F" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Claude: (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <g stroke="#D97757" strokeWidth="2.1" strokeLinecap="round">
        <path d="M12 3v18M4.5 7.5l15 9M19.5 7.5l-15 9" />
      </g>
    </svg>
  ),
  Perplexity: (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <circle cx="12" cy="12" r="8.4" fill="none" stroke="#20808D" strokeWidth="1.7" />
      <path d="M12 3.6v16.8M6 8.4v7l6-4.4 6 4.4v-7L12 12.8z" fill="none" stroke="#20808D" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  ),
  Grok: (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <g stroke="currentColor" strokeWidth="2.3" strokeLinecap="square">
        <path d="M5 4l14 16M19 4L5 20" />
      </g>
    </svg>
  ),
  Gemini: (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path d="M12 2c0 5.52 4.48 10 10 10-5.52 0-10 4.48-10 10 0-5.52-4.48-10-10-10 5.52 0 10-4.48 10-10z" fill="#4285F4" />
    </svg>
  ),
};

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
        <div className="border border-neutral-200 bg-background shadow-xl dark:border-neutral-800">
          <div className="border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
            <p className="text-sm font-semibold">Summarize with AI</p>
            <p className="mt-0.5 text-xs text-neutral-500">Opens your AI with the page pre-filled.</p>
          </div>
          <div className="flex items-center gap-1 p-2">
            {PROVIDERS.map((p) => (
              <a
                key={p.name}
                href={href(p)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
                title={p.name}
                aria-label={p.name}
                className="flex h-10 w-10 items-center justify-center border border-transparent text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:border-neutral-700 dark:hover:bg-neutral-900"
              >
                {Logos[p.name]}
              </a>
            ))}
          </div>
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
