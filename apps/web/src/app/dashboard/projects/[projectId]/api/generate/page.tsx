import type { Metadata } from "next";
import { ApiGenerateWizard } from "./ApiGenerateWizard";

export const metadata: Metadata = { title: "API · Generate", robots: { index: false } };

export default async function ApiGeneratePage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Create API tests</h2>
        <p className="text-xs text-neutral-500">
          Generate <strong>API tests</strong> from an OpenAPI/Swagger spec and/or plain-English requirements — happy paths,
          negative, boundary, validation, and auth. They run as Playwright request tests (no browser), kept separate from your UI tests.
        </p>
      </div>
      <ApiGenerateWizard projectId={projectId} />
    </div>
  );
}
