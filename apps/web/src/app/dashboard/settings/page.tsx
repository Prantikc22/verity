import Link from "next/link";
import type { Metadata } from "next";
import { getPrimaryOrg, getUser } from "@/lib/auth";
import { entitlementsFor } from "@/lib/entitlements";
import { Card, PageHeader } from "@/components/shell/ui";

export const metadata: Metadata = { title: "Settings", robots: { index: false } };

export default async function SettingsPage() {
  const [orgCtx, user] = await Promise.all([getPrimaryOrg(), getUser()]);
  const ent = entitlementsFor(orgCtx?.org);
  const rows: [string, string][] = [
    ["Organization", orgCtx?.org.name ?? "—"],
    ["Your role", orgCtx?.role ?? "—"],
    ["Signed in as", user?.email ?? "—"],
    ["Plan", ent.label],
  ];
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Settings" lead="Organization details, members and preferences. Project settings live inside each project." />
      <Card>
        <dl className="grid gap-3 text-sm sm:grid-cols-[160px_1fr]">
          {rows.map(([k, v]) => <div key={k} className="contents"><dt className="text-neutral-500">{k}</dt><dd className="font-medium capitalize-first">{v}</dd></div>)}
        </dl>
      </Card>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Link href="/dashboard/team"><Card className="transition hover:border-[#D6D1C2]"><div className="font-medium">Members</div><p className="mt-1 text-sm text-neutral-500">Invite teammates and manage roles.</p></Card></Link>
        <Link href="/dashboard/usage"><Card className="transition hover:border-[#D6D1C2]"><div className="font-medium">Usage & Billing</div><p className="mt-1 text-sm text-neutral-500">Plan limits, credits and invoices.</p></Card></Link>
        <a href="/api/shell-preview?on=0"><Card className="transition hover:border-[#D6D1C2]"><div className="font-medium">Switch to the classic dashboard</div><p className="mt-1 text-sm text-neutral-500">The previous layout, while the new workspace is in preview.</p></Card></a>
      </div>
    </div>
  );
}
