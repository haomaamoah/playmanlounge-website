import { login } from "@/lib/mobile/auth";
import { mobileEndpoint } from "@/lib/mobile/http";

export const runtime = "nodejs";
export const POST = mobileEndpoint(login);
