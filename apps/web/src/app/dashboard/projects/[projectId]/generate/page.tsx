import type { Metadata } from "next";
import { GenerateWizard } from "./GenerateWizard";
import { GenerateTestForm } from "../GenerateTestForm";

export const metadata: Metadata = { title: "Generate", robots: { index: false } };

export default async function GeneratePage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Create tests</h2>
        <p className="text-xs text-neutral-500">
          Test a <strong>live web app</strong> (Verity explores it and proposes a full plan) or <strong>locally via MCP</strong> from your IDE.
          Verity generates as many tests as your plan allows and saves them to your test plan.
        </p>
      </div>

      {/* Choice → setup → explore → review → generate (streamed) → done */}
      <GenerateWizard projectId={projectId} />

      {/* Power-user: describe one test exactly */}
      <details className="border border-neutral-200 dark:border-neutral-800">
        <summary className="cursor-pointer px-5 py-3 text-sm font-medium text-neutral-600 dark:text-neutral-300">
          Advanced — describe one test exactly
        </summary>
        <div className="border-t border-neutral-200 p-5 dark:border-neutral-800">
          <GenerateTestForm projectId={projectId} />
        </div>
      </details>
    </div>
  );
}
