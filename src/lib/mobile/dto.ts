/**
 * Wire shapes of docs/API_CONTRACT.md. These are separate from the admin DTOs on purpose: the app needs the
 * order reference and never sees e-mail addresses, payment transaction ids, request keys or demo flags.
 */
export type MobileCustomer = { id: string; email: string; name: string; phone: string; createdAt: string };
export type MobileSession = { accessToken: string; refreshToken: string; expiresAt: string };
export type MobileOrderLine = { itemId: string; name: string; qty: number; unitPrice: number; image: string };
export type MobileOrder = {
  id: string;
  ref: string;
  status: string;
  paymentStatus: string;
  fulfilment: string;
  preferredTime: string;
  notes: string;
  deliveryAddress: string;
  deliveryLatitude: number | null;
  deliveryLongitude: number | null;
  total: number;
  customerName: string;
  customerPhone: string;
  lines: MobileOrderLine[];
  createdAt: string;
  updatedAt: string;
};
export type MobileTicket = { id: string; subject: string; message: string; status: string; phone: string; createdAt: string; updatedAt: string };

type Row = Record<string, unknown>;

/**
 * PostgREST returns `2026-10-12T09:53:26.12345+00:00`; the contract says UTC ISO-8601. Fractional digits are kept
 * as stored (microseconds), so a `createdAt` handed back as `before=` pages without skipping or repeating rows.
 */
export function isoUtc(value: unknown): string {
  const text = String(value ?? "");
  const utc = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?)(?:Z|[+-]00(?::?00)?)?$/.exec(text);
  if (utc) return `${utc[1]}T${utc[2]}Z`;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? text : date.toISOString();
}

export function mobileCustomer(row: Row): MobileCustomer {
  return {
    id: String(row.id),
    email: String(row.email),
    name: String(row.name ?? ""),
    phone: String(row.phone ?? ""),
    createdAt: isoUtc(row.created_at),
  };
}

export function mobileSession(session: { access_token: string; refresh_token: string; expires_at?: number; expires_in?: number }): MobileSession {
  const expiresAtMs = session.expires_at ? session.expires_at * 1000 : Date.now() + (session.expires_in ?? 3600) * 1000;
  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresAt: new Date(expiresAtMs).toISOString(),
  };
}

export function mobileOrder(row: Row): MobileOrder {
  const lines = Array.isArray(row.lines) ? (row.lines as Row[]) : [];
  return {
    id: String(row.id),
    ref: String(row.order_ref ?? ""),
    status: String(row.status),
    paymentStatus: String(row.payment_status),
    fulfilment: String(row.fulfilment),
    preferredTime: String(row.preferred_time ?? ""),
    notes: String(row.notes ?? ""),
    deliveryAddress: String(row.delivery_address ?? ""),
    deliveryLatitude: typeof row.delivery_latitude === "number" ? row.delivery_latitude : null,
    deliveryLongitude: typeof row.delivery_longitude === "number" ? row.delivery_longitude : null,
    total: Number(row.total),
    customerName: String(row.customer_name ?? ""),
    customerPhone: String(row.customer_phone ?? ""),
    lines: lines.map((line) => ({
      itemId: String(line.itemId ?? ""),
      name: String(line.name ?? ""),
      qty: Number(line.qty) || 0,
      unitPrice: Number(line.unitPrice) || 0,
      image: String(line.image ?? ""),
    })),
    createdAt: isoUtc(row.created_at),
    updatedAt: isoUtc(row.updated_at),
  };
}

/** Tickets carry a contact name: the profile name, else the part of the e-mail before "@" (the admin desk shows it). */
export function supportContactName(profileName: string, email: string): string {
  const name = profileName.trim() || email.split("@")[0].trim();
  return name.length >= 2 ? name.slice(0, 100) : "Customer";
}

export function mobileTicket(row: Row): MobileTicket {
  return {
    id: String(row.id),
    subject: String(row.subject ?? ""),
    message: String(row.message ?? ""),
    status: String(row.status),
    phone: String(row.phone ?? ""),
    createdAt: isoUtc(row.created_at),
    updatedAt: isoUtc(row.updated_at),
  };
}
