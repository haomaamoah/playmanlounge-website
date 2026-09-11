import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildReceipt } from "@/lib/mail/html";
import {
  brevoApiKey,
  fromEmail,
  fromName,
  hasMailProvider,
  kioskEmail,
  resendApiKey,
  resendFrom,
  staffOrderEmails,
} from "@/lib/mail/config";
import type { HydratedOrder, ReceiptRole } from "@/lib/mail/types";

export type MailJob = {
  to: string;
  role: ReceiptRole;
  replyTo: string;
  subject: string;
  html: string;
  text: string;
};

export type SendResult =
  | { ok: true; via: "brevo" | "resend" | "mock"; orderRef: string }
  | { ok: false; reason: "no-provider" | "send-failed"; detail?: string };

function jobsFor(order: HydratedOrder): MailJob[] {
  const customer = buildReceipt(order, "customer");
  const staff = buildReceipt(order, "staff");
  const kiosk = kioskEmail();

  return [
    {
      to: order.email,
      role: "customer",
      replyTo: kiosk,
      ...customer,
    },
    ...staffOrderEmails().map((to) => ({
      to,
      role: "staff" as const,
      replyTo: order.email,
      ...staff,
    })),
  ];
}

async function sendBrevo(job: MailJob) {
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "api-key": brevoApiKey(),
    },
    body: JSON.stringify({
      sender: { name: fromName(), email: fromEmail() },
      to: [{ email: job.to }],
      replyTo: { email: job.replyTo },
      subject: job.subject,
      htmlContent: job.html,
      textContent: job.text,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Brevo ${res.status}: ${body.slice(0, 400)}`);
  }
}

async function sendResend(job: MailJob) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: resendFrom(),
      to: [job.to],
      reply_to: job.replyTo,
      subject: job.subject,
      html: job.html,
      text: job.text,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend ${res.status}: ${body.slice(0, 400)}`);
  }
}

async function writeMock(jobs: MailJob[], orderRef: string) {
  const dir = path.join(process.cwd(), ".order-previews", orderRef);
  await mkdir(dir, { recursive: true });
  const index: string[] = [];
  for (const [i, job] of jobs.entries()) {
    const file = `${i + 1}-${job.role}-${job.to.replace(/[^a-z0-9@._-]/gi, "_")}.html`;
    await writeFile(path.join(dir, file), job.html, "utf8");
    index.push(`${job.role} → ${job.to} (${file})`);
  }
  await writeFile(path.join(dir, "index.txt"), index.join("\n") + "\n", "utf8");
}

export async function sendOrderReceipts(order: HydratedOrder): Promise<SendResult> {
  const jobs = jobsFor(order);

  if (brevoApiKey()) {
    try {
      for (const job of jobs) await sendBrevo(job);
      return { ok: true, via: "brevo", orderRef: order.orderRef };
    } catch (error) {
      return {
        ok: false,
        reason: "send-failed",
        detail: error instanceof Error ? error.message : "Brevo send failed",
      };
    }
  }

  if (resendApiKey()) {
    try {
      for (const job of jobs) await sendResend(job);
      return { ok: true, via: "resend", orderRef: order.orderRef };
    } catch (error) {
      return {
        ok: false,
        reason: "send-failed",
        detail: error instanceof Error ? error.message : "Resend send failed",
      };
    }
  }

  if (process.env.NODE_ENV !== "production") {
    await writeMock(jobs, order.orderRef);
    return { ok: true, via: "mock", orderRef: order.orderRef };
  }

  if (!hasMailProvider()) {
    return { ok: false, reason: "no-provider" };
  }

  return { ok: false, reason: "no-provider" };
}
