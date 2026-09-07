// Transactional email via Resend (https://resend.com) - free tier covers this app's
// volume (100/day, 3,000/month). Requires a domain the operator controls to be verified
// with Resend (DNS SPF/DKIM records) and RESEND_API_KEY / RESEND_FROM_EMAIL set as Worker
// secrets; see docs/AUTH_ACCOUNTS.md for setup. Kept dependency-free (plain fetch) since
// Resend's Node SDK is not needed for a single call and the project has almost no runtime
// dependencies by design.
type EmailEnv = { RESEND_API_KEY?: string; RESEND_FROM_EMAIL?: string };

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] as string);
}

export async function sendPasswordResetEmail(env: EmailEnv, options: { to: string; name: string; resetUrl: string }) {
  const { RESEND_API_KEY, RESEND_FROM_EMAIL } = env;
  if (!RESEND_API_KEY || !RESEND_FROM_EMAIL) {
    // Not configured yet (local dev, or production before the operator sets up Resend).
    // Never fail or leak this to the client - the caller always returns the same generic
    // response regardless of whether an email was actually sent, both to avoid revealing
    // account existence and to avoid breaking the flow because of an operational gap. The
    // link is logged so a developer can still exercise the flow locally without email.
    console.warn(`[email] RESEND_API_KEY/RESEND_FROM_EMAIL not configured; not sending. Reset link for ${options.to}: ${options.resetUrl}`);
    return;
  }
  const safeName = escapeHtml(options.name || "");
  const safeUrl = escapeHtml(options.resetUrl);
  const html = `<!doctype html><html lang="he" dir="rtl"><body style="font-family:Arial,Helvetica,sans-serif;background:#f4f6f5;padding:24px;color:#111827">
<div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:28px;">
<h1 style="font-size:18px;margin:0 0 16px">איפוס סיסמה למנהל עבודה</h1>
<p style="margin:0 0 16px;line-height:1.6">שלום${safeName ? ` ${safeName}` : ""},</p>
<p style="margin:0 0 16px;line-height:1.6">קיבלנו בקשה לאיפוס הסיסמה לחשבונך במערכת מנהל עבודה. לחיצה על הכפתור תוביל לקביעת סיסמה חדשה. הקישור תקף לשעה אחת בלבד.</p>
<p style="margin:0 0 24px;text-align:center"><a href="${safeUrl}" style="display:inline-block;background:#059669;color:#fff;text-decoration:none;font-weight:700;padding:12px 24px;border-radius:8px">קביעת סיסמה חדשה</a></p>
<p style="margin:0 0 8px;line-height:1.6;font-size:13px;color:#6b7280">אם הכפתור אינו פועל, ניתן להעתיק את הקישור הבא לדפדפן:<br><span dir="ltr">${safeUrl}</span></p>
<p style="margin:16px 0 0;line-height:1.6;font-size:13px;color:#6b7280">אם לא ביקשת לאפס סיסמה, ניתן להתעלם מהודעה זו - הסיסמה הנוכחית תישאר בתוקף.</p>
</div></body></html>`;
  const text = `שלום${options.name ? ` ${options.name}` : ""},\n\nקיבלנו בקשה לאיפוס הסיסמה לחשבונך במערכת מנהל עבודה. הקישור תקף לשעה אחת בלבד:\n${options.resetUrl}\n\nאם לא ביקשת לאפס סיסמה, ניתן להתעלם מהודעה זו.`;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify({ from: RESEND_FROM_EMAIL, to: options.to, subject: "איפוס סיסמה למנהל עבודה", html, text }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Resend request failed with status ${response.status}: ${detail.slice(0, 500)}`);
  }
}
