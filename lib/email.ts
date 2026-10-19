// Sends email through Resend (https://resend.com), using plain fetch so no extra package is needed.
//
// Email is a nice-to-have, never a requirement: if it isn't set up, or sending fails, the app
// carries on. sendEmail never throws.

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

const DEFAULT_FROM = "Saffron <onboarding@resend.dev>";
const SEND_TIMEOUT_MS = 5000;

export async function sendEmail(message: EmailMessage): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    if (process.env.NODE_ENV !== "production") {
      console.log(`[email not sent: RESEND_API_KEY is not set] To: ${message.to} | ${message.subject}`);
    }
    return false;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || DEFAULT_FROM,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        html: message.html,
      }),
      // A slow email service must not make a booking feel slow or hang.
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });

    if (!res.ok) {
      console.error("Email was not sent:", res.status, await res.text().catch(() => ""));
      return false;
    }
    return true;
  } catch (error) {
    console.error("Email was not sent:", error);
    return false;
  }
}
