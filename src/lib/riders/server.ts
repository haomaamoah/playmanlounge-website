import "server-only";
import type { User } from "@supabase/supabase-js";
import { authClient } from "../admin/server";
import { ApiFailure } from "../admin/validation";
import { db } from "../db/server";
import { publicClient } from "../mobile/supabase";

export type RiderProfile = {
  id: string;
  email: string;
  name: string;
  phone: string;
  bike_model: string;
  bike_color: string;
  license_plate: string;
  is_blocked: boolean;
  created_at: string;
  updated_at: string;
};

export async function findRider(id: string): Promise<RiderProfile | null> {
  const { data, error } = await db().from("rider_profiles")
    .select("id,email,name,phone,bike_model,bike_color,license_plate,is_blocked,created_at,updated_at")
    .eq("id", id).maybeSingle();
  if (error) throw new ApiFailure(503, "Could not load the rider account.");
  return data as RiderProfile | null;
}

export async function getRiderOr404(id: string) {
  const rider = await findRider(id);
  if (!rider) throw new ApiFailure(404, "Rider not found.");
  return rider;
}

async function riderForUser(user: User) {
  const rider = await findRider(user.id);
  if (!rider) throw new ApiFailure(403, "Rider access required.");
  if (rider.is_blocked) throw new ApiFailure(401, "This account is blocked.");
  return rider;
}

export async function requireRider(request: Request) {
  const bearer = /^Bearer\s+([A-Za-z0-9._~+/=-]{20,4096})$/i.exec(request.headers.get("authorization") ?? "");
  let user: User | null = null;
  if (bearer) {
    const { data, error } = await publicClient().auth.getUser(bearer[1]);
    if (error || !data.user) throw new ApiFailure(401, "Sign in to continue.");
    user = data.user;
  } else {
    const auth = await authClient("rider");
    const { data, error } = await auth.auth.getUser();
    if (error || !data.user) throw new ApiFailure(401, "Sign in to continue.");
    user = data.user;
  }
  return riderForUser(user);
}

export async function signInRider(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const { data, error } = await publicClient().auth.signInWithPassword({
    email: normalizedEmail,
    password,
  });
  if (error || !data.user || !data.session) throw new ApiFailure(401, "Email or password is incorrect.");
  try {
    const rider = await riderForUser(data.user);
    return { rider, session: data.session };
  } catch (failure) {
    await publicClient().auth.signOut();
    throw failure;
  }
}

export async function signInRiderWeb(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const auth = await authClient("rider");
  const { data, error } = await auth.auth.signInWithPassword({
    email: normalizedEmail,
    password,
  });
  if (error || !data.user) throw new ApiFailure(401, "Email or password is incorrect.");
  try {
    return publicRider(await riderForUser(data.user));
  } catch (failure) {
    await auth.auth.signOut({ scope: "local" });
    throw failure;
  }
}

export function publicRider(profile: RiderProfile) {
  return {
    id: profile.id,
    email: profile.email,
    name: profile.name,
    phone: profile.phone,
    bikeModel: profile.bike_model,
    bikeColor: profile.bike_color,
    licensePlate: profile.license_plate,
    isBlocked: profile.is_blocked,
    createdAt: profile.created_at,
    updatedAt: profile.updated_at,
  };
}
