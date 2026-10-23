import type { IconName } from "./components/Icons";

export const TABS = ["sheet", "abilities", "inventory", "hero", "notes", "codex", "settings"] as const;

export type Tab = (typeof TABS)[number];

export const NAV_ITEMS: { id: Tab; label: string; icon: IconName }[] = [
  { id: "sheet", label: "Лист", icon: "sheet" },
  { id: "abilities", label: "Способности", icon: "abilities" },
  { id: "inventory", label: "Инвентарь", icon: "inventory" },
  { id: "hero", label: "Герой", icon: "hero" },
  { id: "notes", label: "Заметки", icon: "book" },
  { id: "codex", label: "Кодекс", icon: "library" },
  { id: "settings", label: "Ещё", icon: "settings" },
];
