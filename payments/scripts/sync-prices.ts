/**
 * Regenerates prices.json from the site menu so the payment service prices
 * orders itself instead of trusting the browser.
 *
 *   npm run sync:prices
 */
import { writeFileSync } from "node:fs";
import { menu } from "../../src/lib/content.ts";

const table = Object.fromEntries(
  menu.map((item) => [item.id, { name: item.name, price: item.price }])
);

const target = new URL("../prices.json", import.meta.url);
writeFileSync(target, `${JSON.stringify(table, null, 2)}\n`);
console.log(`wrote ${Object.keys(table).length} prices to ${target.pathname}`);
