import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { menuGroups } from "../src/lib/content";
import { scriptDb } from "./db-client";

const db = scriptDb();
const refreshComboArt = process.argv.includes("--refresh-combo-art");
const ids = ["snack-duo", "rice-and-bites", "street-king", "four-in-one", "big-boy"];

for (const id of ids) {
  const group = menuGroups.find((entry) => entry.items.some((item) => item.id === id));
  const item = group?.items.find((entry) => entry.id === id);
  if (!group || !item) throw new Error(`Missing promotion fixture: ${id}`);
  const current = await db.from("menu_items").select("id").eq("id", id).maybeSingle();
  if (current.error) throw current.error;
  if (current.data && !(refreshComboArt && group.id === "combos")) {
    console.log(`Preserved existing menu item: ${id}`);
    continue;
  }

  const image = await readFile(`public${item.image}`);
  const hash = createHash("sha256").update(image).digest("hex").slice(0, 24);
  const path = `promotions/${hash}.webp`;
  const thumbnail = await sharp(image).resize(144, 144, { fit: "cover" }).jpeg({ quality: 85 }).toBuffer();
  for (const [name, buffer, contentType] of [
    [path, image, "image/webp"],
    [path.replace(/\.webp$/, ".thumb.jpg"), thumbnail, "image/jpeg"],
  ] as const) {
    const upload = await db.storage.from("menu-images").upload(name, buffer, { contentType, upsert: false });
    if (upload.error && !upload.error.message.toLowerCase().includes("exists")) throw upload.error;
  }
  const imageUrl = db.storage.from("menu-images").getPublicUrl(path).data.publicUrl;
  if (current.data) {
    const result = await db.from("menu_items").update({ image_url: imageUrl, width: item.width, height: item.height }).eq("id", id);
    if (result.error) throw result.error;
    console.log(`Updated combo artwork only: ${id}`);
  } else {
    const result = await db.from("menu_items").insert({
      id: item.id, name: item.name, description: item.description, price: item.price, category: item.category,
      image_url: imageUrl, width: item.width, height: item.height, group_id: group.id, group_title: group.title,
      group_blurb: group.blurb, sort_order: ids.indexOf(id), is_active: true,
    });
    if (result.error) throw result.error;
    console.log(`Published deal: ${id}`);
  }
}
console.log("Promotions ready. Existing prices, availability and descriptions were preserved.");
