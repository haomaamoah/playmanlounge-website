/** Yellow is the ride to the kitchen. Blue replaces it once the kitchen sends the order out. */
export function deliveryRouteLeg(status: string): "kitchen" | "customer" {
  return status === "out" || status === "completed" ? "customer" : "kitchen";
}
