import { ACTION_TYPES } from "../data/actions";
import type { Ability, AbilityKind, ActionType } from "../types";

/** «Базовые способности» — источник, а не вид: свободные удары и маневры книги. */
export const BASIC_ABILITY_SOURCE = "Базовые способности";

/** Фильтр панели способностей: вид способности или отдельная группа базовых. */
export type AbilitySheetFilter = "all" | "basic" | AbilityKind;

/**
 * Порядок видов внутри группы действия: сначала знаковые и героические,
 * затем свободные удары и прочее. Базовые способности уходят в конец, чтобы
 * справочник ударов и маневров не занимал первые слоты основного действия.
 */
const KIND_ORDER: Record<AbilityKind, number> = {
  signature: 0,
  heroic: 1,
  "free-strike": 2,
  other: 3,
};

const BASIC_ORDER = 10;

export function isBasicAbility(ability: Ability): boolean {
  return ability.source === BASIC_ABILITY_SOURCE;
}

function sortRank(ability: Ability): number {
  return isBasicAbility(ability) ? BASIC_ORDER : KIND_ORDER[ability.kind];
}

/**
 * Стабильная сортировка: внутри одного вида сохраняется порядок добавления.
 * `Array.prototype.sort` в ES2019+ стабилен, поэтому отдельный индекс не нужен.
 */
export function sortAbilitiesForSheet(abilities: readonly Ability[]): Ability[] {
  return [...abilities].sort((left, right) => sortRank(left) - sortRank(right));
}

export function matchesAbilityFilter(
  ability: Ability,
  filter: AbilitySheetFilter,
): boolean {
  if (filter === "all") return true;
  if (filter === "basic") return isBasicAbility(ability);
  return ability.kind === filter;
}

export function filterAbilitiesForSheet(
  abilities: readonly Ability[],
  filter: AbilitySheetFilter,
): Ability[] {
  return abilities.filter((ability) => matchesAbilityFilter(ability, filter));
}

export interface AbilityFilterOption {
  key: AbilitySheetFilter;
  label: string;
  count: number;
}

const FILTER_LABELS: Record<Exclude<AbilitySheetFilter, "all">, string> = {
  signature: "Знаковые",
  heroic: "Героические",
  "free-strike": "Свободные удары",
  other: "Другие",
  basic: "Базовые",
};

/** Чипы фильтра: «Все» плюс только те категории, которые реально есть. */
export function abilityFilterOptions(
  abilities: readonly Ability[],
): AbilityFilterOption[] {
  const options: AbilityFilterOption[] = [
    { key: "all", label: "Все", count: abilities.length },
  ];
  for (const key of [
    "signature",
    "heroic",
    "free-strike",
    "other",
    "basic",
  ] as const) {
    const count = abilities.filter((ability) =>
      matchesAbilityFilter(ability, key),
    ).length;
    if (count > 0) {
      options.push({ key, label: FILTER_LABELS[key], count });
    }
  }
  return options;
}

export interface AbilityActionGroup {
  key: ActionType;
  label: string;
  short: string;
  hint: string;
  items: Ability[];
}

/** Секции по типу действия в порядке книги; пустые секции не показываются. */
export function abilityActionGroups(
  abilities: readonly Ability[],
): AbilityActionGroup[] {
  return ACTION_TYPES.map((type) => ({
    ...type,
    items: abilities.filter((ability) => ability.actionType === type.key),
  })).filter((group) => group.items.length > 0);
}

/** Полный набор для панели: фильтр, сортировка и секции одним вызовом. */
export function sheetAbilityLayout(
  abilities: readonly Ability[],
  filter: AbilitySheetFilter,
): { groups: AbilityActionGroup[]; visible: number } {
  const visible = filterAbilitiesForSheet(abilities, filter);
  return {
    groups: abilityActionGroups(sortAbilitiesForSheet(visible)),
    visible: visible.length,
  };
}
