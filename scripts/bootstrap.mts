import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { menuGroups } from "../src/lib/content";
import { scriptDb } from "./db-client";

const db = scriptDb();
let sort = 0;
for (const group of menuGroups) {
  for (const item of group.items) {
    // Default reruns are safe: never overwrite a menu item edited by an admin.
    const current = await db.from("menu_items").select("id").eq("id",item.id).maybeSingle();
    if (current.error) throw current.error;
    if (current.data) { sort++; continue; }
    const input = await readFile(`public${item.image}`);
    const {data,info} = await sharp(input).rotate().webp({quality:85}).toBuffer({resolveWithObject:true});
    const hash = createHash("sha256").update(data).digest("hex").slice(0,24);
    const path = `bootstrap/${hash}.webp`;
    const upload = await db.storage.from("menu-images").upload(path,data,{contentType:"image/webp",upsert:false});
    if (upload.error && !upload.error.message.toLowerCase().includes("exists")) throw upload.error;
    const thumb = await sharp(data).resize(144,144,{fit:"cover"}).jpeg({quality:80}).toBuffer();
    const t = await db.storage.from("menu-images").upload(path.replace(/\.webp$/,".thumb.jpg"),thumb,{contentType:"image/jpeg",upsert:false});
    if (t.error && !t.error.message.toLowerCase().includes("exists")) throw t.error;
    const image = db.storage.from("menu-images").getPublicUrl(path).data.publicUrl;
    const result = await db.from("menu_items").insert({
      id:item.id,name:item.name,description:item.description,price:item.price,category:item.category,
      image_url:image,width:info.width,height:info.height,group_id:group.id,group_title:group.title,
      group_blurb:group.blurb,sort_order:sort++,is_active:item.id !== "kitchen-test",
    });
    if (result.error) throw result.error;
    console.log(`Created menu item: ${item.id}`);
  }
}
console.log("Production catalog bootstrap complete; no orders or support fixtures inserted.");
