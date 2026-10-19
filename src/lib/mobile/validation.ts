import type { Fulfilment } from "../email";
import { parseOrderRequest } from "../mail/order";
import { isMomoNetwork, isValidMomoNumber, normaliseSubscriberNumber, type MomoNetwork } from "../payments/networks";
import {
  ADDRESS_MAX,
  ADDRESS_MIN,
  EMAIL_MAX,
  EMAIL_PATTERN,
  GHANA_PHONE_PATTERN,
  IDEMPOTENCY_KEY_PATTERN,
  MAX_LINES,
  MAX_QTY_PER_LINE,
  MESSAGE_MAX,
  MESSAGE_MIN,
  NAME_MAX,
  NOTES_MAX,
  ORDERS_PAGE_DEFAULT,
  ORDERS_PAGE_MAX,
  PASSWORD_MAX,
  PASSWORD_MIN,
  PHONE_MAX,
  SUBJECT_MAX,
  SUBJECT_MIN,
} from "./constants";
import { MobileFailure, validationFailure, type FieldErrors } from "./errors";
import { foldNotes } from "./notes";

/**
 * Strict, field-by-field validation for every mobile request body. Each parser collects ALL problems into
 * `fieldErrors` (keyed by request field name, with a message the app can show verbatim) and throws one
 * `400 validation`; unknown fields are rejected outright.
 */

// Single-line fields refuse every control character; multi-line fields allow tab, LF and CR.
// NUL in particular can never be stored in Postgres text.
const SINGLE_LINE_CONTROLS = /[\u0000-\u001f\u007f]/;
const MULTI_LINE_CONTROLS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
const BAD_CHARACTERS = "That contains characters we cannot accept.";

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function strictObject(raw: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!isRecord(raw)) throw new MobileFailure(400, "Send a JSON object.", { code: "validation" });
  const unknown = Object.keys(raw).find((key) => !keys.includes(key));
  if (unknown !== undefined) {
    const label = /^[A-Za-z0-9_.-]{1,40}$/.test(unknown) ? unknown : undefined;
    throw new MobileFailure(400, label ? `Unknown field: ${label}.` : "Unknown field.", {
      code: "validation",
      fieldErrors: label ? { [label]: "Unknown field." } : undefined,
    });
  }
  return raw;
}

function throwIfAny(errors: FieldErrors) {
  if (Object.keys(errors).length) throw validationFailure(errors);
}

export function emailField(value: unknown, errors: FieldErrors, key = "email"): string {
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!email) errors[key] = "Enter your email.";
  else if (email.length > EMAIL_MAX || !EMAIL_PATTERN.test(email) || SINGLE_LINE_CONTROLS.test(email)) errors[key] = "Enter a valid email address.";
  return email;
}

/** Passwords are never trimmed: spaces are legitimate characters. */
export function passwordField(value: unknown, errors: FieldErrors, key = "password", min = PASSWORD_MIN): string {
  if (typeof value !== "string" || value.length === 0) {
    errors[key] = "Enter a password.";
    return "";
  }
  if (value.length < min) errors[key] = `Use at least ${min} characters.`;
  else if (value.length > PASSWORD_MAX) errors[key] = `Use at most ${PASSWORD_MAX} characters.`;
  return value;
}

function textField(
  value: unknown,
  errors: FieldErrors,
  key: string,
  { min = 0, max, multiline = false, message }: { min?: number; max: number; multiline?: boolean; message: string },
): string {
  if (value === undefined || value === null) {
    if (min > 0) errors[key] = message;
    return "";
  }
  if (typeof value !== "string") {
    errors[key] = message;
    return "";
  }
  const text = value.trim();
  if (text.length < min || text.length > max) errors[key] = message;
  else if ((multiline ? MULTI_LINE_CONTROLS : SINGLE_LINE_CONTROLS).test(text)) errors[key] = BAD_CHARACTERS;
  return text;
}

export function parseSignup(raw: unknown) {
  const body = strictObject(raw, ["name", "email", "phone", "password"]);
  const errors: FieldErrors = {};
  const name = textField(body.name, errors, "name", { min: 1, max: NAME_MAX, message: "Enter your full name." });
  const email = emailField(body.email, errors);
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  if (!phone) errors.phone = "Enter your 10-digit Ghana phone number.";
  else if (!GHANA_PHONE_PATTERN.test(phone) || SINGLE_LINE_CONTROLS.test(phone)) errors.phone = "Enter a valid 10-digit Ghana phone number.";
  const password = passwordField(body.password, errors, "password", PASSWORD_MIN);
  throwIfAny(errors);
  return { name, email, phone, password };
}

/** A password that cannot possibly be valid is a failed login (401), not a 400, so the form rules never leak. */
export function parseLogin(raw: unknown) {
  const body = strictObject(raw, ["identifier", "email", "password"]);
  const errors: FieldErrors = {};
  const isNewIdentifier = body.identifier !== undefined;
  const key = isNewIdentifier ? "identifier" : "email";
  const rawIdentifier = isNewIdentifier ? body.identifier : body.email;
  const identifier = typeof rawIdentifier === "string" ? rawIdentifier.trim() : "";
  if (!identifier) errors[key] = "Enter your email or phone number.";
  else if (identifier.length > EMAIL_MAX || SINGLE_LINE_CONTROLS.test(identifier) ||
    (!EMAIL_PATTERN.test(identifier) && !GHANA_PHONE_PATTERN.test(identifier))) {
    errors[key] = "Enter a valid email address or 10-digit Ghana phone number.";
  }
  const password = passwordField(body.password, errors, "password", 1);
  throwIfAny(errors);
  return {
    identifier: EMAIL_PATTERN.test(identifier) ? identifier.toLowerCase() : identifier,
    password,
  };
}

export function parseRefresh(raw: unknown) {
  const body = strictObject(raw, ["refreshToken"]);
  const token = body.refreshToken;
  if (typeof token !== "string" || token.length < 1 || token.length > 512) {
    throw validationFailure({ refreshToken: "Send the refresh token." });
  }
  return { refreshToken: token };
}

export function parseProfilePatch(raw: unknown) {
  const body = strictObject(raw, ["name", "phone"]);
  if (body.name === undefined && body.phone === undefined) {
    throw validationFailure({}, "Send a name or a phone number to update.");
  }
  const errors: FieldErrors = {};
  const patch: { name?: string; phone?: string } = {};
  if (body.name !== undefined) patch.name = textField(body.name, errors, "name", { max: NAME_MAX, message: "Keep your name under 100 characters." });
  if (body.phone !== undefined) patch.phone = textField(body.phone, errors, "phone", { max: PHONE_MAX, message: "Keep the phone number under 30 characters." });
  throwIfAny(errors);
  return patch;
}

export function parseChangePassword(raw: unknown) {
  const body = strictObject(raw, ["currentPassword", "newPassword"]);
  const errors: FieldErrors = {};
  const currentPassword = passwordField(body.currentPassword, errors, "currentPassword", 1);
  const newPassword = passwordField(body.newPassword, errors, "newPassword");
  throwIfAny(errors);
  return { currentPassword, newPassword };
}

export function parseDeleteAccount(raw: unknown) {
  const body = strictObject(raw, ["password"]);
  const errors: FieldErrors = {};
  const password = passwordField(body.password, errors, "password", 1);
  throwIfAny(errors);
  return { password };
}

export function parseSupport(raw: unknown) {
  const body = strictObject(raw, ["subject", "message", "phone"]);
  const errors: FieldErrors = {};
  const subject = textField(body.subject, errors, "subject", { min: SUBJECT_MIN, max: SUBJECT_MAX, message: `Subject must be ${SUBJECT_MIN} to ${SUBJECT_MAX} characters.` });
  const message = textField(body.message, errors, "message", { min: MESSAGE_MIN, max: MESSAGE_MAX, multiline: true, message: `Message must be ${MESSAGE_MIN} to ${MESSAGE_MAX} characters.` });
  const phone = textField(body.phone, errors, "phone", { max: PHONE_MAX, message: "Keep the phone number under 30 characters." });
  throwIfAny(errors);
  return { subject, message, phone };
}

export type MobileOrderInput = {
  name: string;
  phone: string;
  fulfilment: Fulfilment;
  preferredTime: string;
  deliveryAddress: string;
  deliveryLatitude: number | null;
  deliveryLongitude: number | null;
  /** Exactly what the customer typed (trimmed). */
  notes: string;
  /** What is persisted: the delivery address folded into the notes. */
  storedNotes: string;
  lines: { id: string; qty: number }[];
  expectedTotal?: number;
  payment: MobilePayment;
};

/** How the customer pays. The wallet number is normalised to 233XXXXXXXXX for the gateway. */
export type MobilePayment = { method: "delivery" } | { method: "momo"; network: MomoNetwork; momoNumber: string };

const ORDER_KEYS = ["name", "phone", "fulfilment", "preferredTime", "deliveryAddress", "deliveryLatitude", "deliveryLongitude", "notes", "lines", "expectedTotal", "payment"] as const;
const PAYMENT_KEYS = ["method", "network", "momoNumber"] as const;

/** Absent means pay on delivery, so older app builds keep working unchanged. */
function paymentField(value: unknown, errors: FieldErrors): MobilePayment {
  if (value === undefined || value === null) return { method: "delivery" };
  if (!isRecord(value) || Object.keys(value).some((key) => !(PAYMENT_KEYS as readonly string[]).includes(key))) {
    errors.payment = "Choose how you want to pay.";
    return { method: "delivery" };
  }
  if (value.method === "delivery") return { method: "delivery" };
  if (value.method !== "momo") {
    errors.payment = "Choose pay on delivery or mobile money.";
    return { method: "delivery" };
  }
  const network = value.network;
  if (!isMomoNetwork(network)) errors.network = "Choose your mobile money network.";
  const raw = typeof value.momoNumber === "string" ? value.momoNumber : "";
  const momoNumber = isValidMomoNumber(raw) ? normaliseSubscriberNumber(raw) : null;
  if (!momoNumber) errors.momoNumber = "Enter a 10-digit mobile money number.";
  return isMomoNetwork(network) && momoNumber ? { method: "momo", network, momoNumber } : { method: "delivery" };
}

/** Body of `POST /api/mobile/orders/{id}/payment`: `{ payment: { method, network?, momoNumber? } }`. */
export function parsePaymentRetry(raw: unknown): MobilePayment {
  const body = strictObject(raw, ["payment"]);
  const errors: FieldErrors = {};
  if (body.payment === undefined || body.payment === null) errors.payment = "Choose how you want to pay.";
  const payment = paymentField(body.payment, errors);
  throwIfAny(errors);
  return payment;
}

function orderLines(value: unknown, errors: FieldErrors): { id: string; qty: number }[] {
  const lines: { id: string; qty: number }[] = [];
  if (!Array.isArray(value) || value.length === 0) {
    errors.lines = "Add at least one menu item.";
    return lines;
  }
  if (value.length > MAX_LINES) {
    errors.lines = "Too many items in one order.";
    return lines;
  }
  const seen = new Set<string>();
  for (const entry of value) {
    if (!isRecord(entry) || Object.keys(entry).some((key) => key !== "id" && key !== "qty")) {
      errors.lines = "Each item needs an id and a quantity.";
      break;
    }
    const { id, qty } = entry;
    if (typeof id !== "string" || !id || id.length > 80) {
      errors.lines = "Each item needs an id.";
      break;
    }
    if (typeof qty !== "number" || !Number.isInteger(qty)) {
      errors.lines = "Quantity must be a whole number.";
      break;
    }
    if (qty < 1 || qty > MAX_QTY_PER_LINE) {
      errors.lines = `Quantity must be between 1 and ${MAX_QTY_PER_LINE}.`;
      break;
    }
    if (seen.has(id)) {
      errors.lines = "List each item once and change its quantity instead.";
      break;
    }
    seen.add(id);
    lines.push({ id, qty });
  }
  return lines;
}

/**
 * `accountEmail` is the authenticated customer's address: the body never carries an e-mail. Name, phone, time
 * window, notes length and line limits are judged by the website's own `parseOrderRequest`, so web and mobile
 * orders obey the same rules.
 */
export function parseMobileOrder(raw: unknown, accountEmail: string): MobileOrderInput {
  const body = strictObject(raw, ORDER_KEYS);
  const errors: FieldErrors = {};

  const asText = (key: string, multiline = false) => {
    const value = body[key];
    if (value === undefined || value === null) return "";
    if (typeof value !== "string") {
      errors[key] = "Send this as text.";
      return "";
    }
    if ((multiline ? MULTI_LINE_CONTROLS : SINGLE_LINE_CONTROLS).test(value)) errors[key] = BAD_CHARACTERS;
    return value;
  };
  const name = asText("name").trim();
  const phone = asText("phone").replace(/\s/g, "");
  const preferredTime = asText("preferredTime");
  const notes = asText("notes", true).trim();
  // One line, always: the stored notes read "Delivery address: <address>\n\n<notes>", so the app, the kitchen board
  // and anything that splits at the first blank line can rely on the address never containing one.
  const deliveryAddress = asText("deliveryAddress", true).replace(/\s*[\r\n]+\s*/g, ", ").replace(/[ \t]+/g, " ").trim();
  const coordinate = (key: "deliveryLatitude" | "deliveryLongitude", minimum: number, maximum: number) => {
    const value = body[key];
    if (value === undefined) return null;
    if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum) {
      errors[key] = "Choose a valid delivery location.";
      return null;
    }
    return value;
  };
  const deliveryLatitude = coordinate("deliveryLatitude",-90,90);
  const deliveryLongitude = coordinate("deliveryLongitude",-180,180);
  if ((deliveryLatitude === null) !== (deliveryLongitude === null))
    errors.deliveryLatitude ??= "Choose a valid delivery location.";

  const fulfilment = body.fulfilment === "delivery" || body.fulfilment === "pickup" ? body.fulfilment : undefined;
  if (!fulfilment) errors.fulfilment = "Choose pickup or delivery.";

  if (fulfilment === "delivery" && !errors.deliveryAddress) {
    if (!deliveryAddress) errors.deliveryAddress = "Enter a delivery address.";
    else if (deliveryAddress.length < ADDRESS_MIN) errors.deliveryAddress = "Enter a fuller delivery address.";
    else if (deliveryAddress.length > ADDRESS_MAX) errors.deliveryAddress = `Keep the address under ${ADDRESS_MAX} characters.`;
  } else if (fulfilment === "pickup" && (deliveryAddress || deliveryLatitude !== null || deliveryLongitude !== null)) {
    errors.deliveryAddress = "A delivery address is only for delivery orders.";
  }

  const storedNotes = fulfilment ? foldNotes(fulfilment, deliveryAddress, notes) : notes;
  if (!errors.notes && notes.length > NOTES_MAX) errors.notes = `Keep notes under ${NOTES_MAX} characters.`;
  else if (!errors.notes && storedNotes.length > NOTES_MAX) errors.notes = `Keep the notes shorter: the address and notes together fit in ${NOTES_MAX} characters.`;

  const lines = orderLines(body.lines, errors);
  const payment = paymentField(body.payment, errors);

  let expectedTotal: number | undefined;
  if (body.expectedTotal !== undefined && body.expectedTotal !== null) {
    const total = body.expectedTotal;
    if (typeof total !== "number" || !Number.isFinite(total) || total < 0 || total > 1_000_000) errors.expectedTotal = "Send the total you were shown.";
    else expectedTotal = total;
  }

  const parsed = parseOrderRequest({ name, phone, email: accountEmail, fulfilment, preferredTime, notes: storedNotes, lines });
  for (const [key, message] of Object.entries(parsed.errors ?? {})) {
    const field = key === "cart" ? "lines" : key;
    errors[field] ??= message;
  }
  throwIfAny(errors);
  return { name, phone, fulfilment: fulfilment!, preferredTime, deliveryAddress, deliveryLatitude, deliveryLongitude, notes, storedNotes, lines, expectedTotal, payment };
}

const ISO_UTC = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(\.\d{1,6})?(Z|\+00:00)$/;

/** `limit` 1-50 (default 30) and an optional `before` ISO-8601 instant; microseconds survive so paging is exact. */
export function parseOrdersQuery(url: URL): { limit: number; before?: string } {
  const errors: FieldErrors = {};
  const limitRaw = url.searchParams.get("limit");
  let limit = ORDERS_PAGE_DEFAULT;
  if (limitRaw !== null) {
    limit = /^\d{1,3}$/.test(limitRaw) ? Number(limitRaw) : 0;
    if (limit < 1 || limit > ORDERS_PAGE_MAX) errors.limit = `Use a limit between 1 and ${ORDERS_PAGE_MAX}.`;
  }
  let before: string | undefined;
  const beforeRaw = url.searchParams.get("before");
  if (beforeRaw !== null) {
    // An unencoded "+00:00" arrives as " 00:00".
    const candidate = beforeRaw.replace(/ (\d{2}:\d{2})$/, "+$1");
    const exact = ISO_UTC.exec(candidate);
    if (exact && !Number.isNaN(Date.parse(candidate))) before = `${exact[1]}${exact[2] ?? ""}Z`;
    // Any other instant needs an explicit offset: a bare local time would depend on the server's timezone.
    else if (!exact && candidate.length <= 40 && /^\d{4}-\d{2}-\d{2}T[\d:.]+(Z|[+-]\d{2}:\d{2})$/.test(candidate) && !Number.isNaN(Date.parse(candidate))) {
      before = new Date(candidate).toISOString();
    } else errors.before = "Use an ISO-8601 time, like 2026-10-12T09:00:00Z.";
  }
  throwIfAny(errors);
  return { limit, before };
}

export function parseIdempotencyKey(value: string | null): string {
  if (!value || !IDEMPOTENCY_KEY_PATTERN.test(value)) {
    throw validationFailure({ idempotencyKey: "Send an Idempotency-Key header of 16 to 100 letters, digits or dashes." });
  }
  return value;
}

/** Order ids are UUIDs; anything else cannot exist, so it is a 404 rather than a database type error. */
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
