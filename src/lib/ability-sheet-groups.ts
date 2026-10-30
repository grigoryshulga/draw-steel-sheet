import { ACTION_TYPES, actionLabel, kindLabel } from "../data/actions";
import {
  isAncestryAbility,
  isSubclassAbility,
  type AncestryAbilitySources,
  type SubclassAbilitySources,
} from "./ability-origin";
import type { Ability, AbilityKind, ActionType } from "../types";

/** «Базовые способности» — источник, а не вид: свободные удары и маневры книги. */
export const BASIC_ABILITY_SOURCE = "Базовые способности";

/**
 * Фильтр панели: вид способности, базовые, происхождение из подкласса или
 * происхождение героя. Обе оси происхождения — отдельные фильтры, потому что
 * не входят в `AbilityKind`.
 */
export type AbilitySheetFilter =
  | "all"
  | "basic"
  | "subclass"
  | "ancestry"
  | AbilityKind;

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
 * При непустом запросе сначала идут совпадения — чем больше совпадений в
 * названии, тем выше карточка.
 */
export function sortAbilitiesForSheet(
  abilities: readonly Ability[],
  query = "",
): Ability[] {
  const search = normalizeQuery(query);
  return abilities
    .map((ability, index) => ({
      ability,
      index,
      score: search ? abilitySearchScore(ability, search) : 0,
    }))
    .sort((left, right) => {
      if (search && left.score !== right.score) {
        return right.score - left.score;
      }
      return sortRank(left.ability) - sortRank(right.ability) || left.index - right.index;
    })
    .map((entry) => entry.ability);
}

function normalizeQuery(raw: string): string {
  return raw.trim().toLocaleLowerCase("ru").replaceAll("ё", "е").replace(/\s+/g, " ");
}

function searchableText(ability: Ability): string {
  return normalizeQuery(
    [
      ability.keywords.join(" "),
      ability.flavor,
      ability.distance,
      ability.target,
      ability.trigger,
      ability.effect,
      ability.tiers
        .map((tier) => `${tier.damage} ${tier.effect}`)
        .join(" "),
      ability.source,
      ability.notes,
      kindLabel(ability.kind),
      actionLabel(ability.actionType),
    ].join(" "),
  );
}

/**
 * Оценка совпадения: каждое слово запроса обязано встретиться хотя бы где-то.
 * `-1` — карточка не подходит. Совпадение в названии весит больше, чем в
 * описании; слово в начале названия — ещё больше.
 */
export function abilitySearchScore(ability: Ability, rawQuery: string): number {
  const query = normalizeQuery(rawQuery);
  if (!query) return 0;
  const tokens = query.split(" ");
  const name = normalizeQuery(ability.name);
  const body = searchableText(ability);
  let score = 0;
  for (const token of tokens) {
    const inName = name.includes(token);
    if (!inName && !body.includes(token)) return -1;
    score += inName ? 4 : 1;
    if (name.startsWith(token)) score += 3;
    else if (inName && name.split(/[\s,:;!?«»"()-]+/).some((word) => word.startsWith(token))) {
      score += 1;
    }
  }
  return score;
}

export function matchesAbilityQuery(ability: Ability, rawQuery: string): boolean {
  return abilitySearchScore(ability, rawQuery) >= 0;
}

export function matchesAbilityFilter(
  ability: Ability,
  filter: AbilitySheetFilter,
  subclassSources?: SubclassAbilitySources,
  ancestrySources?: AncestryAbilitySources,
): boolean {
  if (filter === "all") return true;
  if (filter === "basic") return isBasicAbility(ability);
  if (filter === "subclass") {
    return subclassSources
      ? isSubclassAbility(subclassSources, ability)
      : false;
  }
  if (filter === "ancestry") {
    return ancestrySources
      ? isAncestryAbility(ancestrySources, ability)
      : false;
  }
  return ability.kind === filter;
}

export function filterAbilitiesForSheet(
  abilities: readonly Ability[],
  filter: AbilitySheetFilter,
  subclassSources?: SubclassAbilitySources,
  ancestrySources?: AncestryAbilitySources,
): Ability[] {
  return abilities.filter((ability) =>
    matchesAbilityFilter(ability, filter, subclassSources, ancestrySources),
  );
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
  subclass: "Подкласс",
  ancestry: "Происхождение",
};

/** Чипы фильтра: «Все» плюс только те категории, которые реально есть. */
export function abilityFilterOptions(
  abilities: readonly Ability[],
  subclassSources?: SubclassAbilitySources,
  ancestrySources?: AncestryAbilitySources,
): AbilityFilterOption[] {
  const options: AbilityFilterOption[] = [
    { key: "all", label: "Все", count: abilities.length },
  ];
  const subclassCount = subclassSources
    ? abilities.filter((ability) => isSubclassAbility(subclassSources, ability))
        .length
    : 0;
  if (subclassCount > 0) {
    options.push({
      key: "subclass",
      label: FILTER_LABELS.subclass,
      count: subclassCount,
    });
  }
  const ancestryCount = ancestrySources
    ? abilities.filter((ability) => isAncestryAbility(ancestrySources, ability))
        .length
    : 0;
  if (ancestryCount > 0) {
    options.push({
      key: "ancestry",
      label: FILTER_LABELS.ancestry,
      count: ancestryCount,
    });
  }
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

/** Полный набор для панели: фильтр, поиск, сортировка и секции одним вызовом. */
export function sheetAbilityLayout(
  abilities: readonly Ability[],
  filter: AbilitySheetFilter,
  query = "",
  subclassSources?: SubclassAbilitySources,
  ancestrySources?: AncestryAbilitySources,
): { groups: AbilityActionGroup[]; topMatches: Ability[]; visible: number } {
  const visible = filterAbilitiesForSheet(
    abilities,
    filter,
    subclassSources,
    ancestrySources,
  );
  const search = normalizeQuery(query);
  if (!search) {
    return {
      groups: abilityActionGroups(sortAbilitiesForSheet(visible)),
      topMatches: [],
      visible: visible.length,
    };
  }
  const matched = visible.filter(
    (ability) => abilitySearchScore(ability, search) >= 0,
  );
  const rest = visible.filter(
    (ability) => abilitySearchScore(ability, search) < 0,
  );
  return {
    // Совпадения уходят в отдельную секцию наверху, а не растворяются внутри
    // типа действия: игрок сразу видит результат поиска.
    groups: abilityActionGroups(sortAbilitiesForSheet(rest)),
    topMatches: sortAbilitiesForSheet(matched, query),
    visible: visible.length,
  };
}
