import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, welcomeEmail } from "@/lib/email";

export const runtime = "nodejs";

/**
 * Email + password signup. We create the user pre-confirmed via the service role
 * so signup works without an SMTP / email-confirmation round-trip. The client
 * then signs in with the same password to establish the session.
 */
export async function POST(req: NextRequest) {
  let body: { email?: string; password?: string; full_name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  const fullName = (body.full_name ?? "").trim();

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: fullName ? { full_name: fullName } : {},
  });

  if (error) {
    const msg = /already.*registered|already been registered|exists/i.test(error.message)
      ? "An account with this email already exists. Try signing in."
      : error.message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  // Welcome email — best-effort, never blocks or fails signup.
  await sendEmail({ to: email, ...welcomeEmail(fullName) });

  return NextResponse.json({ ok: true });
}
