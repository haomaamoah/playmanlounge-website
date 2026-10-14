import type { MenuGroup } from "./content";

export function matchesSearch(query: string, ...fields: string[]) {
  const term = query.trim().toLowerCase();
  return !term || fields.some((field) => field.toLowerCase().includes(term));
}

export function searchMenuGroups(groups: MenuGroup[], query: string) {
  return groups.map((group) => ({
    ...group,
    items: group.items.filter((item) => matchesSearch(query, item.name, item.description, group.title, group.blurb)),
  })).filter((group) => group.items.length);
}
