// Email sending abstraction.
//
// Uses Resend when RESEND_API_KEY is set; otherwise logs and (in dev/test) the
// caller can surface the verification link. To send real confirmation emails in
// production, set RESEND_API_KEY (+ optional EMAIL_FROM).

export const EMAIL_ENABLED = Boolean(process.env.RESEND_API_KEY);
const RESEND_KEY = process.env.RESEND_API_KEY;
const FROM = process.env.EMAIL_FROM || "Desmake <no-reply@desmake.com>";

export async function sendEmail(to: string, subject: string, html: string): Promise<{ delivered: boolean }> {
  if (RESEND_KEY) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: FROM, to, subject, html }),
        signal: AbortSignal.timeout(15_000),
      });
      return { delivered: res.ok };
    } catch {
      return { delivered: false };
    }
  }
  return { delivered: false };
}

export async function sendVerificationEmail(baseUrl: string, email: string, token: string) {
  const link = `${baseUrl}/api/auth/verify?token=${token}`;
  const html = `<p>Welcome to Desmake. Please confirm your email address to activate your account:</p><p><a href="${link}">${link}</a></p><p>If you did not create this account you can ignore this email.</p>`;
  const r = await sendEmail(email, "Confirm your Desmake email", html);
  return { link, delivered: r.delivered };
}
