import "server-only";
import {
  brevoApiKey,
  fromEmail,
  fromName,
  resendApiKey,
  resendFrom,
} from "@/lib/mail/config";

function htmlEscape(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}

export async function sendNotificationEmail(
  recipients: string[],
  subject: string,
  message: string,
) {
  const uniqueRecipients = [...new Set(recipients.map((email) => email.trim()).filter(Boolean))];
  if (!uniqueRecipients.length) throw new Error("No notification email recipient is configured.");

  const brevo = brevoApiKey();
  const resend = resendApiKey();
  if (!brevo && !resend) throw new Error("Notification email fallback is not configured.");

  for (const email of uniqueRecipients) {
    if (brevo) {
      const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "api-key": brevo,
        },
        body: JSON.stringify({
          sender: { name: fromName(), email: fromEmail() },
          to: [{ email }],
          subject,
          textContent: message,
          htmlContent: `<p>${htmlEscape(message).replace(/\n/g, "<br>")}</p>`,
        }),
      });
      if (!response.ok) {
        const details = (await response.text()).slice(0, 300);
        throw new Error(`Notification email provider returned ${response.status}: ${details}`);
      }
      continue;
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resend}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: resendFrom(),
        to: [email],
        subject,
        text: message,
        html: `<p>${htmlEscape(message).replace(/\n/g, "<br>")}</p>`,
      }),
    });
    if (!response.ok) {
      const details = (await response.text()).slice(0, 300);
      throw new Error(`Notification email provider returned ${response.status}: ${details}`);
    }
  }
}
