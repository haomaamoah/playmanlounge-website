import { checked, endpoint } from "@/lib/admin/server";
import { ApiFailure } from "@/lib/admin/validation";
import { requireCustomer } from "@/lib/customer/server";
import { orderDTO } from "@/lib/db/orders";
import { db } from "@/lib/db/server";
import { hasActiveRiderTracking } from "@/lib/riders/privacy";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  return endpoint(async () => {
    const { profile } = await requireCustomer();
    const { id } = await context.params;
    const { data, error } = await db()
      .from("orders")
      .select("*")
      .eq("id", id)
      .eq("customer_email", profile.email)
      .maybeSingle();
    if (!data && !error) throw new ApiFailure(404, "Order not found.");
    const row = checked(data, error);
    const item = orderDTO(row);
    if (row.rider_id) {
      const hasActiveDelivery = hasActiveRiderTracking(row.rider_delivery_status);
      const [profile, location] = await Promise.all([
        db().from("rider_profiles").select("id,name,phone,bike_model,bike_color,license_plate").eq("id", row.rider_id).maybeSingle(),
        hasActiveDelivery
          ? db().from("rider_locations").select("latitude,longitude,updated_at").eq("rider_id", row.rider_id).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);
      if (profile.error || location.error) throw new ApiFailure(503, "Could not load delivery rider details.");
      return {
        ok: true,
        item: {
          ...item,
          rider: profile.data ? {
            id: profile.data.id, name: profile.data.name, phone: profile.data.phone,
            bikeModel: profile.data.bike_model, bikeColor: profile.data.bike_color,
            licensePlate: profile.data.license_plate,
          } : null,
          riderLocation: location.data ? {
            latitude: Number(location.data.latitude), longitude: Number(location.data.longitude),
            updatedAt: String(location.data.updated_at),
          } : null,
        },
      };
    }
    return { ok: true, item: { ...item, rider: null, riderLocation: null } };
  })(request);
}
