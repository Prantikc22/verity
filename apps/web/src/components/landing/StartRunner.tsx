"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

/**
 * Runs the "try it" generation for a signed-in user: POSTs the URL/description
 * to /api/start (which provisions a project + generates + saves the test), then
 * lands them in the project with the test already there.
 */
export function StartRunner({ input }: { input: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<"working" | "error" | "empty">(input ? "working" : "empty");
  const [error, setError] = useState("");
  const ran = useRef(false);

  useEffect(() => {
    if (!input || ran.current) return;
    ran.current = true;
    (async () => {
      try {
        const res = await fetch("/api/start", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ input }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
        router.replace(`/dashboard/projects/${data.projectId}/tests?created=1`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
        setStatus("error");
      }
    })();
  }, [input, router]);

  if (status === "empty") {
    return (
      <div className="w-full text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Nothing to generate yet</h1>
        <p className="mt-2 text-neutral-600 dark:text-neutral-300">Paste your app&apos;s URL on the home page to get your first test.</p>
        <Link href="/" className="mt-6 inline-block bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-500">Back home</Link>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="w-full text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Couldn&apos;t generate that</h1>
        <p className="mt-2 text-sm text-red-600">{error}</p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/dashboard" className="border border-neutral-300 px-5 py-2.5 text-sm font-medium dark:border-neutral-700">Go to dashboard</Link>
          <Link href="/" className="bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-500">Try another URL</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full text-center">
      <div className="mx-auto mb-6 h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-indigo-600" />
      <h1 className="text-2xl font-semibold tracking-tight">Generating your first test…</h1>
      <p className="mt-2 text-neutral-600 dark:text-neutral-300">
        Opening <span className="font-medium text-neutral-900 dark:text-white">{input}</span>, writing a Playwright spec, and saving it to your project. This takes ~10–20s.
      </p>
    </div>
  );
}
