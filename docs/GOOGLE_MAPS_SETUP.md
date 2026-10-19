# Google Maps setup

The website loads Maps JavaScript, Places autocomplete, and the Routes library in the browser. The map picker also reverse-geocodes a dropped pin.

## Configure the browser key

Set `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` in the local environment used by Next.js and in the production hosting environment. The value is public in a browser bundle; never use a server-only credential here.

Enable billing and these APIs in the same Google Cloud project:

- Maps JavaScript API
- Places API (New)
- Routes API
- Geocoding API

Restrict the key to the production and development website referrers and only the APIs above. Use a separate key for each platform and rotate any key that has been pasted into chat or otherwise exposed. A missing or unauthorized key is shown as an explicit Maps error in the location controls; orders cannot be placed until a delivery address and GPS pin are both set.

## Behavior

- Checkout requires a Places result, current location, or confirmed map pin; it persists the formatted address with latitude and longitude for nearest-kitchen routing.
- Kitchen create/edit uses the same search and map picker and persists the address and pin.
- The order detail route action is disabled when the kitchen or delivery coordinates are absent. When available, it requests a driving route through Routes API and draws the route in green.
- Location maps offer roadmap, satellite, and terrain types.
