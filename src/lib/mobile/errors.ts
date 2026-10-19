import { ApiFailure } from "../admin/validation";

export type MobileErrorCode =
  | "validation"
  | "invalid_credentials"
  | "email_taken"
  | "unauthorized"
  | "not_found"
  | "price_changed"
  | "idempotency_conflict"
  | "rate_limited"
  | "payment_unavailable"
  | "payment_conflict"
  | "rider_unavailable"
  | "missing_delivery_location"
  | "rider_location_unavailable"
  | "route_unavailable"
  | "unavailable";

export type FieldErrors = Record<string, string>;

type FailureOptions = {
  code?: MobileErrorCode;
  fieldErrors?: FieldErrors;
  /** Extra top-level keys of the failure body, e.g. `{ total }` on price_changed. */
  extra?: Record<string, unknown>;
  /** Seconds, sent as the Retry-After header. */
  retryAfter?: number;
};

/** An ApiFailure that also carries the machine `code` and `fieldErrors` the mobile contract defines. */
export class MobileFailure extends ApiFailure {
  code?: MobileErrorCode;
  fieldErrors?: FieldErrors;
  extra?: Record<string, unknown>;
  retryAfter?: number;
  constructor(status: number, message: string, options: FailureOptions = {}) {
    super(status, message);
    this.code = options.code;
    this.fieldErrors = options.fieldErrors;
    this.extra = options.extra;
    this.retryAfter = options.retryAfter;
  }
}

const UNAVAILABLE_MESSAGE = "Play Man Lounge is having trouble right now. Try again in a moment.";

export const validationFailure = (fieldErrors: FieldErrors, message?: string) =>
  new MobileFailure(400, message ?? Object.values(fieldErrors)[0] ?? "Check your details and try again.", {
    code: "validation",
    fieldErrors: Object.keys(fieldErrors).length ? fieldErrors : undefined,
  });
export const unavailable = (message = UNAVAILABLE_MESSAGE) => new MobileFailure(503, message, { code: "unavailable" });
export const unauthorized = (message = "Your session has expired. Sign in again.") =>
  new MobileFailure(401, message, { code: "unauthorized" });
export const notFound = (message = "We could not find that.") => new MobileFailure(404, message, { code: "not_found" });

export type FailureView = {
  status: number;
  headers: Record<string, string>;
  body: { ok: false; error: string; code?: MobileErrorCode; fieldErrors?: FieldErrors } & Record<string, unknown>;
};

function codeFor(status: number): MobileErrorCode | undefined {
  if (status === 429) return "rate_limited";
  if (status >= 500) return "unavailable";
  if (status === 401) return "unauthorized";
  if (status === 404) return "not_found";
  if (status === 400 || status === 413) return "validation";
  return undefined;
}

/**
 * Turns anything a mobile handler throws into the contract's failure body. Plain ApiFailures come from the shared
 * helpers (rateLimit, jsonBody, object, checked, audit); unexpected errors never leak their message.
 */
export function describeFailure(error: unknown): FailureView {
  const mobile = error instanceof MobileFailure ? error : undefined;
  const failure = error instanceof ApiFailure ? error : undefined;
  const status = failure?.status ?? 503;
  const message = mobile ? mobile.message : failure && status < 500 ? failure.message : UNAVAILABLE_MESSAGE;
  const code = mobile?.code ?? codeFor(status);
  const retryAfter = mobile?.retryAfter ?? (status === 429 ? 60 : undefined);
  const body: FailureView["body"] = { ok: false, error: message };
  if (code) body.code = code;
  if (mobile?.fieldErrors) body.fieldErrors = mobile.fieldErrors;
  for (const [key, value] of Object.entries(mobile?.extra ?? {})) if (!(key in body)) body[key] = value;
  const headers: Record<string, string> = { "Cache-Control": "no-store" };
  if (retryAfter) headers["Retry-After"] = String(Math.ceil(retryAfter));
  return { status, headers, body };
}
