/**
 * Transactional email via Resend (direct REST — no SDK dependency).
 * Sends are best-effort: they never throw, so email failures can't break a
 * request path like signup. Guarded by RESEND_API_KEY.
 */
const RESEND_URL = "https://api.resend.com/emails";

export function emailFrom(): string {
  return process.env.INVITE_FROM_EMAIL ?? "Verity <hello@qashifthq.com>";
}

export function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "https://verity.qashifthq.com";
}

export function emailEnabled(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendEmail(opts: { to: string; subject: string; html: string }): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return;
  try {
    await fetch(RESEND_URL, {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ from: emailFrom(), ...opts }),
    });
  } catch {
    /* never break the caller on an email failure */
  }
}

/** Brand-consistent shell for Verity transactional emails. */
function shell(heading: string, bodyHtml: string): string {
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f7f8fb;color:#0b1220;font-family:-apple-system,'Segoe UI',sans-serif;">
    <div style="max-width:560px;margin:0 auto;padding:40px 24px;">
      <div style="font-size:1.3rem;font-weight:800;color:#0b1220;margin-bottom:6px;">Verity</div>
      <div style="font-size:0.72rem;letter-spacing:1px;text-transform:uppercase;color:#6366f1;margin-bottom:28px;">A QAShift product</div>
      <div style="font-size:1.35rem;font-weight:700;color:#0b1220;margin-bottom:14px;">${heading}</div>
      <div style="color:#3f4657;line-height:1.7;font-size:0.95rem;">${bodyHtml}</div>
      <div style="color:#8a91a6;font-size:0.78rem;border-top:1px solid #e6e8ef;padding-top:20px;margin-top:36px;line-height:1.6;">
        Questions? Just reply — a human answers within 4 business hours.<br>
        Verity · part of the QAShift testing platform · AI writes, engineers verify.
      </div>
    </div></body></html>`;
}

export function welcomeEmail(name?: string): { subject: string; html: string } {
  const hi = name ? `Hi ${name.split(" ")[0]},` : "Hi there,";
  const url = appUrl();
  return {
    subject: "Welcome to Verity 👋",
    html: shell(
      "You're in. Here's how to get value fast.",
      `<p>${hi} welcome to Verity — AI-augmented testing that runs in your own CI and heals itself.</p>
       <p style="font-weight:600;color:#0b1220;margin-top:18px;">Three steps to your first green run:</p>
       <ol style="padding-left:18px;line-height:1.9;">
         <li><strong>Create a project</strong> and grab your ingest token.</li>
         <li><strong>Generate tests</strong> from a URL or a short description — you review what gets added.</li>
         <li><strong>Wire your CI</strong> (GitHub/GitLab/Jenkins) and runs become unlimited.</li>
       </ol>
       <p style="margin-top:22px;">
         <a href="${url}/dashboard" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;font-weight:700;padding:11px 22px;">Open your dashboard →</a>
       </p>
       <p style="margin-top:20px;font-size:0.88rem;color:#6b7280;">On the free Cloud Sandbox you get 15 AI test generations a month. Need self-healing, API tests and 3 projects? <a href="${url}/pricing" style="color:#4f46e5;">Self-Serve Pro is $49/mo</a>.</p>`,
    ),
  };
}
