/**
 * Runs the payment service on plain Node so it can be exercised without a
 * Cloudflare account:
 *
 *   node --experimental-strip-types src/dev-server.ts
 *
 * Credentials come from the environment (see .dev.vars.example).
 */
import { createServer } from "node:http";
import { handleRequest } from "./handler.ts";
import type { Env } from "./theteller.ts";

const port = Number(process.env.PORT ?? 8787);

const env: Env = {
  THETELLER_API_USER: process.env.THETELLER_API_USER,
  THETELLER_API_KEY: process.env.THETELLER_API_KEY,
  THETELLER_MERCHANT_ID: process.env.THETELLER_MERCHANT_ID,
  THETELLER_MODE: process.env.THETELLER_MODE,
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS,
  MAX_ORDER_TOTAL: process.env.MAX_ORDER_TOTAL,
};

createServer(async (incoming, outgoing) => {
  const chunks: Buffer[] = [];
  for await (const chunk of incoming) chunks.push(chunk as Buffer);
  const hasBody = incoming.method !== "GET" && incoming.method !== "HEAD";

  const request = new Request(`http://localhost:${port}${incoming.url ?? "/"}`, {
    method: incoming.method,
    headers: incoming.headers as Record<string, string>,
    body: hasBody && chunks.length ? Buffer.concat(chunks) : undefined,
  });

  const response = await handleRequest(request, env);
  outgoing.writeHead(response.status, Object.fromEntries(response.headers));
  outgoing.end(Buffer.from(await response.arrayBuffer()));
}).listen(port, () => {
  const mode = env.THETELLER_MODE === "live" ? "live" : "test";
  console.log(`payment service on http://127.0.0.1:${port} (theTeller ${mode} mode)`);
});
