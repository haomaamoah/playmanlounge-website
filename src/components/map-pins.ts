/**
 * Map pins shared by the admin, manager, customer and rider web portals:
 * a scooter for the rider, a pot for the kitchen and a house for the customer.
 * Geometry and colours mirror `lib/map_pins.dart` in the Flutter rider app so
 * the same place looks the same on every screen.
 */
export type MapPinKind = "rider" | "kitchen" | "customer";

const fills: Record<MapPinKind, string> = {
  rider: "#E54102",
  kitchen: "#3A1A04",
  customer: "#1B7A45",
};

const stroke = 'fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"';

const glyphs: Record<MapPinKind, (fill: string) => string> = {
  rider: () => `
    <circle cx="-16" cy="12" r="8" ${stroke}/>
    <circle cx="16" cy="12" r="8" ${stroke}/>
    <path d="M-8 7H8L18 -16M10 -16L26 -20" ${stroke}/>
    <rect x="-22" y="-8" width="20" height="8" rx="3" fill="#fff"/>`,
  kitchen: () => `
    <path d="M-8 -26Q-2 -34 -8 -42M8 -26Q14 -34 8 -42M-18 -14H18" ${stroke}/>
    <circle cx="0" cy="-20" r="3.5" fill="#fff"/>
    <path d="M-18 -10L-14 14Q0 22 14 14L18 -10M-18 -2H-28M18 -2H28" ${stroke}/>`,
  customer: (fill) => `
    <path d="M-22 0L0 -22L22 0Z" fill="#fff"/>
    <rect x="-16" y="0" width="32" height="24" rx="2" fill="#fff"/>
    <rect x="-5" y="8" width="10" height="16" rx="1" fill="${fill}"/>`,
};

function pinSvg(kind: MapPinKind) {
  const fill = fills[kind];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="192" viewBox="0 0 144 192">
  <defs><filter id="s" x="-50%" y="-100%" width="200%" height="300%"><feGaussianBlur stdDeviation="3"/></filter></defs>
  <ellipse cx="72" cy="178" rx="20" ry="7" fill="#000" fill-opacity="0.33" filter="url(#s)"/>
  <path d="M52 98L72 186L92 98Z" fill="${fill}"/>
  <circle cx="72" cy="68" r="52" fill="${fill}"/>
  <circle cx="72" cy="68" r="45" fill="none" stroke="#fff" stroke-width="5"/>
  <g transform="translate(72 68)">${glyphs[kind](fill)}</g>
</svg>`;
}

const urls = new Map<MapPinKind, string>();

export function mapPinUrl(kind: MapPinKind) {
  let url = urls.get(kind);
  if (!url) {
    url = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(pinSvg(kind))}`;
    urls.set(kind, url);
  }
  return url;
}

/** Drawn at 48×64 with the point of the pin, not its centre, on the location. */
export function mapPinIcon(maps: typeof google.maps, kind: MapPinKind): google.maps.Icon {
  return {
    url: mapPinUrl(kind),
    scaledSize: new maps.Size(48, 64),
    anchor: new maps.Point(24, 62),
  };
}
