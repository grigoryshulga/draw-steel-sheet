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

/** Labels shared by document titles and navigation; add new routes here. */
export const TAB_LABELS: Record<Tab, string> = {
  sheet: "Герой",
  development: "Развитие",
  inventory: "Инвентарь",
  notes: "Журнал",
  companions: "Спутники",
  codex: "Кодекс",
  catalog: "Каталоги",
  glossary: "Глоссарий",
  settings: "Настройки",
  create: "Создание героя",
};

export const LIBRARY_TABS = ["codex", "catalog", "glossary"] as const;
export type LibraryTab = (typeof LIBRARY_TABS)[number];

export function isHeroTab(tab: string): tab is HeroTab {
  return HERO_TABS.some((item) => item === tab);
}

export function isLibraryTab(tab: string): tab is LibraryTab {
  return LIBRARY_TABS.some((item) => item === tab);
}
