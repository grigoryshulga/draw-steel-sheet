import type { IconName } from "./components/Icons";

export const HERO_TABS = [
  "sheet",
  "development",
  "inventory",
  "notes",
  "companions",
] as const;

export type HeroTab = (typeof HERO_TABS)[number];

export const TABS = [
  ...HERO_TABS,
  "codex",
  "catalog",
  "glossary",
  "settings",
  "create",
] as const;

export type Tab = (typeof TABS)[number];

/** Две основные вкладки плавающей шапки. */
export const NAV_ITEMS: { id: Tab; label: string; icon: IconName }[] = [
  { id: "sheet", label: "Герой", icon: "sheet" },
  { id: "codex", label: "Кодекс", icon: "library" },
];
