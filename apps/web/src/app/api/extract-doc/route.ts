import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Extract plain text from an uploaded PRD document (PDF / DOCX / text) so it can
 * be used as generation context. Authed (any signed-in user). Text files are
 * handled client-side; this covers the binary formats.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (file.size > 8 * 1024 * 1024) return NextResponse.json({ error: "File too large (max 8MB)." }, { status: 413 });

  const buf = Buffer.from(await file.arrayBuffer());
  const name = file.name.toLowerCase();

  try {
    let text = "";
    if (name.endsWith(".pdf")) {
      // Import the lib directly — pdf-parse's index.js runs a debug block that
      // reads a sample file and crashes when there's no module.parent.
      const pdf = (await import("pdf-parse/lib/pdf-parse.js")).default;
      text = (await pdf(buf)).text;
    } else if (name.endsWith(".docx")) {
      const mammoth = await import("mammoth");
      text = (await mammoth.extractRawText({ buffer: buf })).value;
    } else {
      text = buf.toString("utf8");
    }
    return NextResponse.json({ ok: true, text: text.slice(0, 12000).trim() });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not read the document." }, { status: 500 });
  }
}
