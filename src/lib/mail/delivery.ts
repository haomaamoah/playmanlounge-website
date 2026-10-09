import { createHash } from "node:crypto";

export type DeliveryJob = { role: string; to: string };
export type ClaimRow = { job_key: string; state: string; claim_token: string | null };
export type DeliveryStore = {
  claim(keys: string[]): Promise<ClaimRow[]>;
  complete(key: string, token: string, sent: boolean, error?: string): Promise<boolean>;
};
export type DeliveryOutcome =
  | { ok: true; sent: number; alreadySent: number; inFlight: number }
  | { ok: false; sent: number; failed: number; detail: string };

export function deliveryKey(job: DeliveryJob) {
  return `${job.role}:${createHash("sha256").update(job.to.trim().toLowerCase()).digest("hex").slice(0, 32)}`;
}

/** Stable per order and recipient, so providers that honour it collapse replays. */
export function providerIdempotencyKey(orderId: string, key: string) {
  return `pml-${orderId}-${key.replace(":", "-")}`;
}

/**
 * Sends only the jobs this request claimed. Jobs already sent are skipped and
 * jobs held by a concurrent request are left to it, so replays never duplicate.
 */
export async function deliverClaimed<J extends DeliveryJob>(
  jobs: J[],
  store: DeliveryStore,
  send: (job: J, key: string) => Promise<void>,
): Promise<DeliveryOutcome> {
  const byKey = new Map<string, J>();
  for (const job of jobs) if (!byKey.has(deliveryKey(job))) byKey.set(deliveryKey(job), job);
  const rows = await store.claim([...byKey.keys()]);
  // A lost completion leaves the claim leased; it is retried only after expiry.
  const complete = (key: string, token: string, ok: boolean, error?: string) =>
    store.complete(key, token, ok, error).catch(() => false);
  let sent = 0, alreadySent = 0, inFlight = 0, failed = 0;
  let detail = "";
  for (const row of rows) {
    const job = byKey.get(row.job_key);
    if (!job) continue;
    if (!row.claim_token) {
      if (row.state === "sent") alreadySent++; else inFlight++;
      continue;
    }
    try {
      await send(job, row.job_key);
    } catch (error) {
      failed++;
      detail ||= error instanceof Error ? error.message : "Send failed";
      await complete(row.job_key, row.claim_token, false, detail);
      continue;
    }
    await complete(row.job_key, row.claim_token, true);
    sent++;
  }
  return failed ? { ok: false, sent, failed, detail } : { ok: true, sent, alreadySent, inFlight };
}
