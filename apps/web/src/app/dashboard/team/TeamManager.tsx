"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface Member { userId: string; email: string; name: string | null; role: "owner" | "admin" | "member"; isSelf: boolean }

const ROLE_BADGE: Record<string, string> = {
  owner: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300",
  admin: "bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300",
  member: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300",
};

export function TeamManager({ members, canManage, pending = [] }: { members: Member[]; canManage: boolean; pending?: { email: string; role: string }[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(""); setNotice("");
    try {
      const res = await fetch("/api/org/members", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: email.trim(), role }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't add member.");
      setEmail("");
      setNotice(data.status === "invited" ? "Invite sent — they'll join automatically when they sign in with this email." : "Member added.");
      router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Failed."); } finally { setBusy(false); }
  }

  async function revokeInvite(inviteEmail: string) {
    if (!confirm(`Revoke the invite for ${inviteEmail}?`)) return;
    const res = await fetch(`/api/org/members?invite=${encodeURIComponent(inviteEmail)}`, { method: "DELETE" });
    if (res.ok) router.refresh();
  }

  async function changeRole(userId: string, newRole: "admin" | "member") {
    setError(""); setNotice("");
    const res = await fetch("/api/org/members", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ userId, role: newRole }) });
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? "Failed."); return; }
    router.refresh();
  }

  async function remove(userId: string, email: string) {
    if (!confirm(`Remove ${email} from this org?`)) return;
    setError(""); setNotice("");
    const res = await fetch(`/api/org/members?userId=${userId}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? "Failed."); return; }
    router.refresh();
  }

  return (
    <div className="space-y-5">
      {canManage && (
        <form onSubmit={add} className="flex flex-wrap items-end gap-2 border border-neutral-200 p-4 dark:border-neutral-800">
          <label className="flex-1">
            <span className="text-[11px] font-medium text-neutral-600 dark:text-neutral-400">Add by email</span>
            <input value={email} onChange={(e) => setEmail(e.target.value)} required type="email" placeholder="teammate@company.com"
              className="mt-1 w-full border border-neutral-300 bg-transparent px-2.5 py-1.5 text-sm outline-none focus:border-indigo-500 dark:border-neutral-700" />
          </label>
          <label>
            <span className="text-[11px] font-medium text-neutral-600 dark:text-neutral-400">Role</span>
            <select value={role} onChange={(e) => setRole(e.target.value as "admin" | "member")} className="mt-1 block border border-neutral-300 bg-transparent px-2.5 py-1.5 text-sm outline-none dark:border-neutral-700 dark:bg-neutral-950">
              <option value="member">Member (view)</option>
              <option value="admin">Admin (manage)</option>
            </select>
          </label>
          <button disabled={busy} className="bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{busy ? "Adding…" : "Add"}</button>
        </form>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {notice && <p className="text-sm text-emerald-600">{notice}</p>}

      <div className="divide-y divide-neutral-100 border border-neutral-200 dark:divide-neutral-800/60 dark:border-neutral-800">
        {members.map((m) => (
          <div key={m.userId} className="flex items-center gap-3 p-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-100 text-xs font-medium uppercase dark:bg-neutral-800">{(m.name ?? m.email).slice(0, 2)}</div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{m.name ?? m.email}{m.isSelf && <span className="ml-1.5 text-[10px] text-neutral-400">you</span>}</div>
              {m.name && <div className="truncate text-xs text-neutral-500">{m.email}</div>}
            </div>
            <span className={`px-1.5 py-0.5 text-[10px] font-semibold uppercase ${ROLE_BADGE[m.role]}`}>{m.role}</span>
            {canManage && m.role !== "owner" && !m.isSelf && (
              <div className="flex items-center gap-1.5">
                <select value={m.role} onChange={(e) => changeRole(m.userId, e.target.value as "admin" | "member")} className="border border-neutral-300 bg-transparent px-1.5 py-1 text-[11px] outline-none dark:border-neutral-700 dark:bg-neutral-950">
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
                <button onClick={() => remove(m.userId, m.email)} className="text-[11px] text-red-600 hover:underline">Remove</button>
              </div>
            )}
          </div>
        ))}
      </div>

      {canManage && pending.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-medium">Pending invites <span className="text-neutral-400">({pending.length})</span></h3>
          <div className="divide-y divide-neutral-100 border border-neutral-200 dark:divide-neutral-800/60 dark:border-neutral-800">
            {pending.map((p) => (
              <div key={p.email} className="flex items-center gap-3 p-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-50 text-amber-600 dark:bg-amber-950/40">✉</div>
                <div className="min-w-0 flex-1"><div className="truncate text-sm">{p.email}</div><div className="text-[11px] text-neutral-400">invited as {p.role} · joins on first sign-in</div></div>
                <button onClick={() => revokeInvite(p.email)} className="text-[11px] text-red-600 hover:underline">Revoke</button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="border border-neutral-200 p-4 text-xs text-neutral-500 dark:border-neutral-800">
        <p className="font-medium text-neutral-700 dark:text-neutral-300">Roles</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-5">
          <li><strong>Owner</strong> — full control + billing. One per org.</li>
          <li><strong>Admin</strong> — manage projects, members, and CI; everything except billing ownership.</li>
          <li><strong>Member</strong> — view projects, tests, runs, and all result dashboards (read-only).</li>
        </ul>
      </div>
    </div>
  );
}
