// Renders the morning brief as email HTML and sends it through Resend.
// Needs RESEND_API_KEY. EMAIL_FROM defaults to Resend's shared test sender
// until a domain is verified.

import type { BriefItem } from "@/lib/brief";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://familyos-lac.vercel.app";

export function renderBriefEmail(
  firstName: string,
  dateLabel: string,
  intro: string | null,
  items: BriefItem[]
): string {
  const rows = items
    .map(
      (it) => `
      <tr>
        <td style="padding:14px 16px;border-top:1px solid #E2E8F0;vertical-align:top;width:36px;font-size:20px;">${it.icon}</td>
        <td style="padding:14px 16px 14px 0;border-top:1px solid #E2E8F0;">
          <p style="margin:0;font-size:15px;line-height:1.45;color:#1E293B;">${it.text}</p>
          <p style="margin:4px 0 0;font-size:12px;color:#64748B;">${it.meta}</p>
        </td>
      </tr>`
    )
    .join("");

  return `<!doctype html>
<html>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #E2E8F0;">
        <tr><td style="background:#26584A;padding:20px 24px;">
          <p style="margin:0;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#9ED0C2;">FamilyOS · ${dateLabel}</p>
          <p style="margin:6px 0 0;font-size:20px;font-weight:700;color:#ffffff;">Good morning, ${firstName}</p>
        </td></tr>
        ${
          intro
            ? `<tr><td style="padding:18px 24px 4px;"><p style="margin:0;font-size:15px;line-height:1.5;color:#1E293B;">${intro}</p></td></tr>`
            : ""
        }
        <tr><td style="padding:10px 8px 6px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
        </td></tr>
        <tr><td style="padding:8px 24px 24px;" align="center">
          <a href="${SITE}/today" style="display:inline-block;background:#26584A;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 28px;border-radius:10px;">Open today's brief</a>
          <p style="margin:14px 0 0;font-size:11px;color:#94A3B8;">You're getting this because the morning brief email is on in FamilyOS.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function sendEmail(to: string, subject: string, html: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set");
  const from = process.env.EMAIL_FROM || "FamilyOS <onboarding@resend.dev>";
  // When inbound email is configured, replies to the brief flow back into
  // the app through /api/inbound.
  const replyTo = process.env.EMAIL_REPLY_TO;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({ from, to, subject, html, ...(replyTo ? { reply_to: replyTo } : {}) }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend ${res.status}: ${body.slice(0, 300)}`);
  }
}
