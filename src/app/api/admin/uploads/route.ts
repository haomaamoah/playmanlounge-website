import sharp from "sharp";
import { randomUUID } from "node:crypto";
import { audit, checkOrigin, endpoint, limitedBody, rateLimit, requireAdmin } from "@/lib/admin/server";
import { ApiFailure } from "@/lib/admin/validation";
import { db } from "@/lib/db/server";
export const runtime = "nodejs";
export const POST = endpoint(async request => {
  checkOrigin(request); const admin = await requireAdmin();
  await rateLimit(request,"upload",20,3600,admin.id);
  if (Number(request.headers.get("content-length") ?? 0) > 6*1024*1024) throw new ApiFailure(413,"Image exceeds 5 MB.");
  const bytes = await limitedBody(request,6*1024*1024);
  const form = await new Response(new Uint8Array(bytes),{headers:{"Content-Type":request.headers.get("content-type") ?? ""}}).formData();
  if ([...form.keys()].some(k => k !== "file") || form.getAll("file").length !== 1) throw new ApiFailure(400,"Send one image file.");
  const file = form.get("file");
  if (!(file instanceof File) || !["image/jpeg","image/png","image/webp"].includes(file.type) || file.size === 0 || file.size > 5*1024*1024) throw new ApiFailure(400,"Use a JPEG, PNG or WebP up to 5 MB.");
  const input = Buffer.from(await file.arrayBuffer());
  let image: Buffer, thumb: Buffer, width: number, height: number;
  try {
    const pipeline = sharp(input,{limitInputPixels:25_000_000,animated:false});
    const metadata = await pipeline.metadata();
    const formats: Record<string,string> = {"image/jpeg":"jpeg","image/png":"png","image/webp":"webp"};
    if (metadata.format !== formats[file.type] || (metadata.pages ?? 1) > 1) throw new Error("Invalid image.");
    const encoded = await pipeline.rotate().resize({width:1600,height:1600,fit:"inside",withoutEnlargement:true}).webp({quality:85}).toBuffer({resolveWithObject:true});
    image = encoded.data; width = encoded.info.width; height = encoded.info.height;
    thumb = await sharp(encoded.data).resize(144,144,{fit:"cover"}).jpeg({quality:80}).toBuffer();
  } catch { throw new ApiFailure(400,"Image could not be decoded safely."); }
  const path = `${admin.id}/${randomUUID()}.webp`;
  await audit(admin.id,"image_upload",path);
  const client = db();
  const {error} = await client.storage.from("menu-images").upload(path,image,{contentType:"image/webp",upsert:false});
  if (error) throw error;
  const t = await client.storage.from("menu-images").upload(path.replace(/\.webp$/,".thumb.jpg"),thumb,{contentType:"image/jpeg",upsert:false});
  if (t.error) throw t.error;
  return {ok:true,path,imageUrl:client.storage.from("menu-images").getPublicUrl(path).data.publicUrl,width,height};
});
