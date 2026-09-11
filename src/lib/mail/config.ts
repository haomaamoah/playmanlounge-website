import { site } from "@/lib/content";

const DEFAULT_STAFF = ["amoahinfotech@gmail.com"] as const;

export function staffOrderEmails() {
  const fromEnv = process.env.ORDER_STAFF_EMAILS?.trim();
  if (!fromEnv) return [...DEFAULT_STAFF];
  return fromEnv
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function kioskEmail() {
  return (
    process.env.ORDER_KIOSK_EMAIL?.trim() ||
    process.env.NEXT_PUBLIC_ORDER_EMAIL?.trim() ||
    site.email
  );
}

export function fromEmail() {
  return process.env.ORDER_FROM_EMAIL?.trim() || kioskEmail();
}

export function fromName() {
  return process.env.ORDER_FROM_NAME?.trim() || site.name;
}

export function resendFrom() {
  return (
    process.env.RESEND_FROM?.trim() ||
    `${fromName()} <onboarding@resend.dev>`
  );
}

export function siteUrl() {
  const explicit = process.env.SITE_URL?.trim() || process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL.replace(/\/$/, "")}`;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`;
  }
  return "http://127.0.0.1:43123";
}

export function absoluteUrl(path: string) {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const prefix = path.startsWith("/") ? path : `/${path}`;
  return `${siteUrl()}${prefix}`;
}

export function brevoApiKey() {
  return process.env.BREVO_API_KEY?.trim() || "";
}

export function resendApiKey() {
  return process.env.RESEND_API_KEY?.trim() || "";
}

export function hasMailProvider() {
  return Boolean(brevoApiKey() || resendApiKey());
}
