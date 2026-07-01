import type { Metadata } from "next";
import Link from "next/link";
import { MobileGenerateWizard } from "./MobileGenerateWizard";

export const metadata: Metadata = { title: "Mobile · Generate", robots: { index: false } };

export default async function MobileGeneratePage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Generate mobile flows</h2>
          <p className="text-xs text-neutral-500">AI-generated mobile app flows (YAML) for your native app, saved to <code>tests/verity/mobile/</code>. Run on an emulator/simulator (or real devices) from your CI.</p>
        </div>
        <Link href={`/dashboard/projects/${projectId}/ci`} className="shrink-0 border border-indigo-300 px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 dark:border-indigo-800 dark:hover:bg-indigo-950/30">⚙️ Turn on Mobile in CI →</Link>
      </div>
      <MobileGenerateWizard projectId={projectId} />
    </div>
  );
}
