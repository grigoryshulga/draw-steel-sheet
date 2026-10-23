import type { IconName } from "./components/Icons";

export const TABS = [
  "sheet",
  "inventory",
  "hero",
  "notes",
  "codex",
  "catalog",
  "glossary",
  "settings",
] as const;

export type Tab = (typeof TABS)[number];

export const NAV_ITEMS: { id: Tab; label: string; icon: IconName }[] = [
  { id: "sheet", label: "Лист", icon: "sheet" },
  { id: "inventory", label: "Инвентарь", icon: "inventory" },
  { id: "notes", label: "Журнал", icon: "book" },
  { id: "codex", label: "Кодекс", icon: "library" },
];
