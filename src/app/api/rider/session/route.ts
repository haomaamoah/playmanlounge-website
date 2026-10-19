import { endpoint } from "@/lib/admin/server";
import { requireRider, publicRider } from "@/lib/riders/server";

export const GET = endpoint(async (request) => ({
  ok: true,
  rider: publicRider(await requireRider(request)),
}));
