import assert from "node:assert/strict";
import { test } from "node:test";
import { deliverClaimed, deliveryKey, providerIdempotencyKey, type ClaimRow, type DeliveryStore } from "./delivery";

/** Mirrors claim_order_notifications: only pending/failed rows are claimable. */
function memoryStore() {
  const rows = new Map<string, { state: string; token: string | null }>();
  let n = 0;
  const store: DeliveryStore = {
    async claim(keys) {
      const out: ClaimRow[] = [];
      for (const key of keys) {
        const row = rows.get(key) ?? { state: "pending", token: null };
        rows.set(key, row);
        if (row.state === "pending" || row.state === "failed") {
          row.state = "sending"; row.token = `t${++n}`;
          out.push({ job_key: key, state: "sending", claim_token: row.token });
        } else out.push({ job_key: key, state: row.state, claim_token: null });
      }
      return out;
    },
    async complete(key, token, sent) {
      const row = rows.get(key);
      if (!row || row.token !== token || row.state !== "sending") return false;
      row.state = sent ? "sent" : "failed"; row.token = null;
      return true;
    },
  };
  return { rows, store };
}
const jobs = [{ role: "customer", to: "ama@example.com" }, { role: "staff", to: "kitchen@example.com" }, { role: "staff", to: "boss@example.com" }];

test("partial failure resends only the unsent recipients", async () => {
  const { store } = memoryStore();
  const sent: string[] = [];
  const first = await deliverClaimed(jobs, store, async job => { if (job.to === "boss@example.com") throw new Error("boom"); sent.push(job.to); });
  assert.equal(first.ok, false);
  const second = await deliverClaimed(jobs, store, async job => { sent.push(job.to); });
  assert.deepEqual(second, { ok: true, sent: 1, alreadySent: 2, inFlight: 0 });
  assert.deepEqual(sent, ["ama@example.com", "kitchen@example.com", "boss@example.com"]);
});

test("replays after full delivery send nothing", async () => {
  const { store } = memoryStore();
  let count = 0;
  await deliverClaimed(jobs, store, async () => { count++; });
  const replay = await deliverClaimed(jobs, store, async () => { count++; });
  assert.equal(count, 3);
  assert.deepEqual(replay, { ok: true, sent: 0, alreadySent: 3, inFlight: 0 });
});

test("concurrent requests never send the same recipient twice", async () => {
  const { store } = memoryStore();
  const sent: string[] = [];
  const slow = async (job: { to: string }) => { await new Promise(r => setTimeout(r, 5)); sent.push(job.to); };
  const [a, b] = await Promise.all([deliverClaimed(jobs, store, slow), deliverClaimed(jobs, store, slow)]);
  assert.equal(sent.length, 3);
  assert.ok(a.ok && b.ok);
});

test("lost completion keeps the claim rather than failing the order", async () => {
  const { store } = memoryStore();
  const broken: DeliveryStore = { claim: store.claim, complete: async () => { throw new Error("db down"); } };
  const out = await deliverClaimed(jobs.slice(0, 1), broken, async () => {});
  assert.deepEqual(out, { ok: true, sent: 1, alreadySent: 0, inFlight: 0 });
});

test("keys are stable, case-insensitive and do not expose addresses", () => {
  assert.equal(deliveryKey({ role: "staff", to: "Kitchen@Example.com " }), deliveryKey({ role: "staff", to: "kitchen@example.com" }));
  assert.ok(!deliveryKey(jobs[0]).includes("@"));
  assert.match(providerIdempotencyKey("0f1e", deliveryKey(jobs[0])), /^pml-0f1e-customer-[0-9a-f]{32}$/);
});
