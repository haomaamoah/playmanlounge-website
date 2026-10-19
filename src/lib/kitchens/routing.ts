export type KitchenLocation = {
  id: string;
  latitude: number;
  longitude: number;
};

function distanceSquaredApprox(latitude: number, longitude: number, kitchen: KitchenLocation) {
  const latitudeScale = Math.cos((latitude * Math.PI) / 180);
  const latitudeDelta = kitchen.latitude - latitude;
  const longitudeDelta = (kitchen.longitude - longitude) * latitudeScale;
  return latitudeDelta * latitudeDelta + longitudeDelta * longitudeDelta;
}

export function nearestKitchen(
  kitchens: readonly KitchenLocation[],
  latitude: number,
  longitude: number,
): KitchenLocation | null {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return kitchens.reduce<KitchenLocation | null>((nearest, kitchen) => {
    if (!nearest || distanceSquaredApprox(latitude, longitude, kitchen) <
      distanceSquaredApprox(latitude, longitude, nearest)) return kitchen;
    return nearest;
  }, null);
}
