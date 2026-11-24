"use client";

import { useState } from "react";

/** Inline request for a people-delivered service. No sales sequence: one reply from a person. */
export function ServiceRequest({ service, label, placeholder, primary = false }: { service: "managed-diagnostic" | "managed-enterprise" | "accessibility-audit"; label: string; placeholder: string; primary?: boolean }) {
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [err, setErr] = useState("");
  const send = async () => {
    setState("sending");
    const res = await fetch("/api/services/request", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ service, details }) });
    if (res.ok) { setState("sent"); return; }
    setErr((await res.json().catch(() => ({}))).error ?? "Couldn't send. Email hello@qashifthq.com."); setState("error");
  };
  const btn = primary
    ? "rounded-lg bg-neutral-900 px-3.5 py-2 text-[13px] font-medium text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
    : "rounded-lg border border-neutral-300 px-3.5 py-2 text-[13px] font-medium hover:border-neutral-500 dark:border-neutral-700";
  if (state === "sent") return <p role="status" className="text-[13px] text-emerald-700 dark:text-emerald-400">Request sent. A person replies within 4 business hours (Mon to Fri, 9:00 to 19:00 IST).</p>;
  if (!open) return <button type="button" className={btn} onClick={() => setOpen(true)}>{label}</button>;
  return (
    <div className="w-full space-y-2">
      <textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={3} placeholder={placeholder} maxLength={2000}
        className="w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-[13px] dark:border-neutral-700" />
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={state === "sending"} onClick={send} className={`${btn} disabled:opacity-60`}>{state === "sending" ? "Sending…" : "Send request"}</button>
        <button type="button" onClick={() => setOpen(false)} className="text-[13px] text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200">Cancel</button>
        {state === "error" && <span className="text-[12.5px] text-red-600">{err}</span>}
      </div>
    </div>
  );
}
