/**
 * Product rules shared with the Flutter app (`lib/core/rules.dart`, `lib/data/models/*`) and described in
 * docs/API_CONTRACT.md of the mobile repo. Change the app, the contract and this file together.
 */
export const PASSWORD_MIN = 6;
export const PASSWORD_MAX = 128;
export const EMAIL_MAX = 254;
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const NAME_MAX = 100;
export const PHONE_MAX = 30;
export const GHANA_PHONE_PATTERN = /^0[0-9]{9}$/;

export const ADDRESS_MIN = 3;
export const ADDRESS_MAX = 300;
export const NOTES_MAX = 800;
export const ADDRESS_PREFIX = "Delivery address: ";

export const SUBJECT_MIN = 3;
export const SUBJECT_MAX = 160;
export const MESSAGE_MIN = 10;
export const MESSAGE_MAX = 4000;

export const MAX_LINES = 30;
export const MAX_QTY_PER_LINE = 20;
export const ORDERS_PAGE_DEFAULT = 30;
export const ORDERS_PAGE_MAX = 50;
export const SUPPORT_LIST_MAX = 100;

/** Kitchen order window, mirrored from `validateOrderInput` in src/lib/mail/order.ts. */
export const ORDERING_WINDOW = { opensAt: "12:00", closesAt: "23:00", timezone: "Africa/Accra" } as const;

export const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9-]{16,100}$/;

/** Abuse limits as [max hits, window in seconds]. Each use documents its identity (IP bucket, e-mail, customer id). */
export const LIMITS = {
  signupPerIp: [10, 3600],
  loginPerIp: [100, 900],
  loginPerEmail: [10, 900],
  passwordPerCustomer: [5, 900],
  deletePerCustomer: [5, 900],
  ordersPerCustomer: [20, 3600],
  supportPerCustomer: [5, 3600],
  // A wallet prompt per attempt: the same caps the website puts on /api/payments/start.
  paymentPerCustomer: [10, 900],
  paymentPerWallet: [5, 900],
  paymentStatusPerCustomer: [240, 900],
} as const satisfies Record<string, readonly [number, number]>;

/**
 * Per-address limits only make sense when the client address is known, i.e. TRUST_PROXY_IP=1 behind a proxy that
 * overwrites x-forwarded-for (Vercel does). Without it the shared `rateLimit()` helper puts every visitor into ONE
 * bucket, and a ceiling meant for one address (10 sign-ups an hour) would lock out the whole customer base. That
 * shared bucket therefore gets a ceiling sized for everybody: it only guards against floods. Per-account limits
 * (e-mail, customer id) are never scaled.
 */
export const SHARED_IP_BUCKET_FACTOR = 20;
export const ipBucketCeiling = (max: number, trustProxyIp: boolean) => (trustProxyIp ? max : max * SHARED_IP_BUCKET_FACTOR);
