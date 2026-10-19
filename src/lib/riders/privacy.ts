export function hasActiveRiderTracking(status: unknown): status is "assigned" | "picked_up" {
  return status === "assigned" || status === "picked_up";
}
