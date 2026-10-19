import { createHmac } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
if (process.env.NODE_ENV === "production" || process.env.RIDER_DEMO_SEED_ENABLED !== "true") {
  throw new Error("Demo rider seed is disabled. Set RIDER_DEMO_SEED_ENABLED=true in a local development environment.");
}
if (!url || !localHosts.has(new URL(url).hostname)) {
  throw new Error("Demo riders may only be seeded into a local Supabase instance.");
}
if (!key) throw new Error("Set the local Supabase service-role key before seeding demo riders.");
const pepper = process.env.RIDER_AUTH_PEPPER;
if (!pepper || pepper.length < 32) throw new Error("Set a local RIDER_AUTH_PEPPER (at least 32 characters).");
const authPepper = pepper;

const password = process.env.RIDER_DEMO_PASSWORD ?? "rider";
const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const fixtures = [
  { email: "rider.spintex@example.test", name: "Spintex Test Rider", phone: "+233000000001", bike_model: "Demo motorcycle", bike_color: "Orange", license_plate: "TEST-001", latitude: 5.6277, longitude: -0.0692 },
  { email: "rider.madina@example.test", name: "Madina Test Rider", phone: "+233000000002", bike_model: "Demo motorcycle", bike_color: "Blue", license_plate: "TEST-002", latitude: 5.6810, longitude: -0.1680 },
];

function authPassword(email: string) {
  return createHmac("sha256", authPepper).update(`rider:v1:${email}\0${password}`).digest("hex");
}

for (const fixture of fixtures) {
  const { data: current, error: findError } = await client.from("rider_profiles")
    .select("id").eq("email", fixture.email).maybeSingle();
  if (findError) throw new Error(`Could not find local demo rider ${fixture.email}: ${findError.message}`);
  let id = current?.id as string | undefined;
  if (id) {
    const { error } = await client.auth.admin.updateUserById(id, {
      password: authPassword(fixture.email), email_confirm: true, ban_duration: "none",
    });
    if (error) throw new Error(`Could not reset local demo rider ${fixture.email}: ${error.message}`);
    const { error: profileError } = await client.from("rider_profiles").update({
      name: fixture.name, phone: fixture.phone, bike_model: fixture.bike_model,
      bike_color: fixture.bike_color, license_plate: fixture.license_plate, is_blocked: false,
    }).eq("id", id);
    if (profileError) throw new Error(`Could not update local demo rider ${fixture.email}: ${profileError.message}`);
  } else {
    const { data, error } = await client.auth.admin.createUser({
      email: fixture.email, password: authPassword(fixture.email), email_confirm: true,
    });
    if (error || !data.user) throw new Error(`Could not create local demo rider ${fixture.email}: ${error?.message ?? "No auth user returned."}`);
    id = data.user.id;
    const { error: profileError } = await client.from("rider_profiles").insert({
      id, email: fixture.email, name: fixture.name, phone: fixture.phone,
      bike_model: fixture.bike_model, bike_color: fixture.bike_color, license_plate: fixture.license_plate,
    });
    if (profileError) {
      await client.auth.admin.deleteUser(id);
      throw new Error(`Could not save local demo rider ${fixture.email}: ${profileError.message}`);
    }
  }
  const { error: locationError } = await client.from("rider_locations").upsert({
    rider_id: id, latitude: fixture.latitude, longitude: fixture.longitude,
  });
  if (locationError) throw new Error(`Could not save local demo rider location ${fixture.email}: ${locationError.message}`);
}

console.log("Seeded local Spintex and Madina demo riders. Sign in with each fixture email and the configured rider demo password.");
