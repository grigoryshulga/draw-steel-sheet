import { codexIndex } from "../../rules/codex-navigation";
import type { Locale } from "../../i18n/locale";

/** Preserve a renamed creature; only translate an unchanged canonical name. */
export function creatureDisplayName(sourceId: string | undefined, name: string, locale: Locale): string {
  if (locale !== "en" || !sourceId) return name;
  const source = codexIndex.find(entry => entry.id === sourceId);
  return source?.title === name ? source.director?.originalName || name : name;
}

/** Stable taxonomy labels, used only for the published, fixed game categories. */
export function creatureCategory(value: string, locale: Locale): string {
  const originals: Record<string, string> = { "Лидер": "Leader", "Орда": "Horde", "Миньон": "Minion", "Одиночка": "Solo", "Засадник": "Ambusher", "Артиллерист": "Artillery", "Громила": "Brute", "Контроллер": "Controller", "Проклинатель": "Hexer", "Налётчик": "Harrier", "Поддержка": "Support" };
  return locale === "en" ? originals[value] || value : value;
}

/** Local multiplayer is intentionally unavailable; explain this in the chosen language. */
export function tableItemError(message: string, locale: Locale): string {
  if (locale === "en" && message === "Для передачи предметов между игроками нужен стол в Supabase")
    return "A Supabase table is required to transfer items between players.";
  return message;
}
