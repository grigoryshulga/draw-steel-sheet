import identity from "../generated/consumers/sheet-identity-en.json";
import type { Locale } from "../i18n/locale";
import type { InventoryItem } from "../types";

const names: Record<string, string> = identity.names;
const subclasses: Record<string, Record<string, string>> = identity.subclasses;
const titles: Record<string, { name: string; originalName: string }> = identity.titles;

export function identityLabel(value: string, locale: Locale, className?: string) {
  return locale === "en" ? (className ? subclasses[className]?.[value] : names[value]) ?? value : value;
}

export function titleLabel(item: InventoryItem, locale: Locale) {
  const entry = item.catalogId && titles[item.catalogId];
  return locale === "en" && entry && entry.name === item.name ? entry.originalName : item.name;
}
