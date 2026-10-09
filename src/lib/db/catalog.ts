import "server-only";
import type { AdminMenuItem } from "../admin/contracts";
import type { MenuGroup, MenuItem } from "../content";
import { db } from "./server";
import { checked } from "../admin/server";

export function menuDTO(row: Record<string, unknown>): AdminMenuItem {
  return {
    id:String(row.id), name:String(row.name), description:String(row.description), price:Number(row.price),
    category:row.category as MenuItem["category"], image:String(row.image_url),
    width:Number(row.width),height:Number(row.height),groupId:String(row.group_id),
    groupTitle:String(row.group_title),groupBlurb:String(row.group_blurb),sortOrder:Number(row.sort_order),
    isActive:Boolean(row.is_active),createdAt:String(row.created_at),updatedAt:String(row.updated_at),
  };
}
export async function getCatalog() {
  const {data,error} = await db().from("menu_items").select("*").eq("is_active",true).order("sort_order").order("id");
  return checked(data,error).map(menuDTO);
}
export async function publicCatalog() {
  const rows = await getCatalog();
  const items: MenuItem[] = rows.map(({id,name,description,price,category,image,width,height}) => ({id,name,description,price,category,image,width,height}));
  const groups: MenuGroup[] = [];
  rows.forEach((row,index) => {
    let group = groups.find(g => g.id === row.groupId);
    if (!group) { group = {id:row.groupId,title:row.groupTitle,blurb:row.groupBlurb,items:[]}; groups.push(group); }
    group.items.push(items[index]);
  });
  return {ok:true as const,items,groups};
}
/** Server-only loader for server components; throws when the live catalog is unavailable. */
export async function loadMenuGroups(): Promise<MenuGroup[]> {
  return (await publicCatalog()).groups;
}
export function menuRow(input: Record<string, unknown>) {
  const names: Record<string,string> = {image:"image_url",groupId:"group_id",groupTitle:"group_title",groupBlurb:"group_blurb",sortOrder:"sort_order",isActive:"is_active"};
  return Object.fromEntries(Object.entries(input).map(([k,v]) => [names[k] ?? k,v]));
}
