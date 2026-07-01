"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Mode = "signin" | "signup";

export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const dest = next || "/dashboard";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "signup" && password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setBusy(true);
    setError("");
    const supabase = createClient();
    try {
      if (mode === "signup") {
        const res = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email, password, full_name: fullName }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Could not create account.");
      }
      const { error: signErr } = await supabase.auth.signInWithPassword({ email, password });
      if (signErr) throw new Error(signErr.message);
      router.push(dest);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-6 flex border border-neutral-200 p-1 text-sm dark:border-neutral-800">
        {(["signin", "signup"] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => { setMode(m); setError(""); }}
            className={`flex-1 px-3 py-1.5 transition ${mode === m ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900" : "text-neutral-500"}`}
          >
            {m === "signin" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>

      <form onSubmit={onSubmit} className="space-y-3">
        {mode === "signup" && (
          <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full name"
            className="w-full border border-neutral-300 bg-transparent px-3 py-2.5 text-sm outline-none focus:border-indigo-500 dark:border-neutral-700 dark:focus:border-indigo-400" />
        )}
        <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com"
          className="w-full border border-neutral-300 bg-transparent px-3 py-2.5 text-sm outline-none focus:border-indigo-500 dark:border-neutral-700 dark:focus:border-indigo-400" />
        <input type="password" required autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={mode === "signup" ? "Create a password (8+ chars)" : "Password"}
          className="w-full border border-neutral-300 bg-transparent px-3 py-2.5 text-sm outline-none focus:border-indigo-500 dark:border-neutral-700 dark:focus:border-indigo-400" />
        {mode === "signup" && (
          <input type="password" required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Confirm password"
            className="w-full border border-neutral-300 bg-transparent px-3 py-2.5 text-sm outline-none focus:border-indigo-500 dark:border-neutral-700 dark:focus:border-indigo-400" />
        )}
        <button type="submit" disabled={busy}
          className="w-full bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50">
          {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
        </button>
      </form>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}
