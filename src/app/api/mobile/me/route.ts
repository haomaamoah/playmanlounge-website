import { deleteAccount, getProfile, updateProfile } from "@/lib/mobile/auth";
import { mobileEndpoint } from "@/lib/mobile/http";

export const runtime = "nodejs";
export const GET = mobileEndpoint(getProfile);
export const PATCH = mobileEndpoint(updateProfile);
export const DELETE = mobileEndpoint(deleteAccount);
