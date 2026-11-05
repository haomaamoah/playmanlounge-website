import type { LivePortal, LiveViewer } from "./changes";

type LiveAuthentication = {
  cookie: (portal: LivePortal) => Promise<LiveViewer | null>;
  customer: (request: Request) => Promise<{ id: string; email: string }>;
  rider: (request: Request) => Promise<{ id: string }>;
};

export async function authenticateLiveViewer(
  request: Request,
  portal: LivePortal,
  auth: LiveAuthentication,
): Promise<LiveViewer | null> {
  if (!request.headers.has("authorization")) return auth.cookie(portal);
  if (!/^Bearer\s+[A-Za-z0-9._~+/=-]{20,4096}$/i.test(request.headers.get("authorization") ?? "")) return null;
  if (portal === "customer") {
    const customer = await auth.customer(request);
    return { portal, id: customer.id, email: customer.email };
  }
  if (portal === "rider") {
    const rider = await auth.rider(request);
    return { portal, id: rider.id };
  }
  return null;
}
