import { PlaymanSite } from "@/components/playman-site";
import { loadMenuGroups } from "@/lib/db/catalog";
import type { MenuGroup } from "@/lib/content";

export const dynamic = "force-dynamic";

export default async function Home() {
  let groups: MenuGroup[] = [];
  let menuUnavailable = false;
  try {
    groups = await loadMenuGroups();
  } catch {
    console.error("The customer menu could not be loaded from the database.");
    menuUnavailable = true;
  }
  return <PlaymanSite groups={groups} menuUnavailable={menuUnavailable} />;
}
