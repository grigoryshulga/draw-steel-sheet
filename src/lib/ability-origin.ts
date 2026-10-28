import { ABILITY_COMPENDIUM } from "../data/compendium";
import { censorDomainAbilities } from "../data/class-features/censor-abilities";
import { conduitAbilities } from "../data/class-features/conduit-abilities";
import { DOMAIN_GRANTED_ABILITIES } from "../data/creation-rules";
import { LEVEL_UP_RULES } from "../data/level-up-rules";
import { FEATURE_MECHANICS } from "../data/class-features/mechanics";
import { classFeatureChoicesForSheet } from "./class-feature-view";
import { normalizeFeatureText } from "./utils";
import type { Ability, Character } from "../types";

/** Вид подкласса: у каждого класса своя ось (орден, доктрина, коллегия…). */
export interface SubclassKind {
  key: string;
  label: string;
}

/** Источник карточки: «Орден · Идеал» или «Домен · Созидание». */
export interface SubclassAbilitySource extends SubclassKind {
  value: string;
  text: string;
}

/** Ключ по id, а для старых карточек — по названию и источнику. */
export type SubclassAbilitySources = Map<string, SubclassAbilitySource>;

const SUBCLASS_KIND_BY_CLASS: Record<string, SubclassKind> = {
  неистовый: { key: "aspect", label: "Аспект" },
  цензор: { key: "order", label: "Орден" },
  проводник: { key: "domain", label: "Домен" },
  тактик: { key: "doctrine", label: "Доктрина" },
  талант: { key: "tradition", label: "Традиция" },
  нуль: { key: "tradition", label: "Традиция" },
  тень: { key: "college", label: "Коллегия" },
  элементалист: { key: "specialization", label: "Специализация" },
  трубадур: { key: "troupe", label: "Труппа" },
};

const DOMAIN_KIND: SubclassKind = { key: "domain", label: "Домен" };
const GENERIC_KIND: SubclassKind = { key: "subclass", label: "Подкласс" };

/** ID варианта домена → название: старые листы могли сохранить ID. */
const DOMAIN_OPTION_LABELS = new Map<string, string>();
for (const mechanics of Object.values(FEATURE_MECHANICS)) {
  const choice = mechanics.choice;
  if (!choice || (choice.group !== "censor.domain" && choice.group !== "conduit.domain")) {
    continue;
  }
  for (const option of choice.options) {
    DOMAIN_OPTION_LABELS.set(option.id, option.label);
  }
}

function normalize(value: string | undefined): string {
  return normalizeFeatureText(value ?? "");
}

/** Составной ключ для карточек, у которых id не совпал с реестром. */
function abilityKey(ability: Pick<Ability, "name" | "source">): string {
  return `${normalize(ability.name)}|${normalize(ability.source)}`;
}

/**
 * Домены героя. У Цензора домен хранится отдельным выбором, у Проводника —
 * парой в том же выборе или в поле подкласса.
 */
function selectedDomains(character: Character): string[] {
  const selections = character.automation?.classFeatureSelections ?? {};
  const explicit =
    selections["censor.domain"] ?? selections["conduit.domain"];
  const raw = typeof explicit === "string" ? explicit : "";
  // Панель листа хранит у Цензора id варианта (`censor.domain.sozdanie`),
  // билдер — название («Созидание»). Приводим оба вида к названию.
  const choice = classFeatureChoicesForSheet(character).find(
    (item) => item.group === "censor.domain" || item.group === "conduit.domain",
  );
  const resolve = (value: string) =>
    choice?.optionLabels?.[value] ?? DOMAIN_OPTION_LABELS.get(value) ?? value;
  if (raw.trim()) {
    return raw
      .split(/[,;/]/)
      .map((part) => resolve(part.trim()))
      .filter(Boolean);
  }
  // У Проводника пара доменов может лежать прямо в подклассе. У Цензора
  // подкласс — это орден, поэтому его сюда не подставляем.
  if (normalize(character.className) === normalize("Проводник")) {
    return (character.subclass ?? "")
      .split(/[,;/]/)
      .map((part) => resolve(part.trim()))
      .filter(Boolean);
  }
  return [];
}

/**
 * Карточки, выданные подклассом: гранты повышения уровня с `subclasses`,
 * доменные способности первого уровня и доменные способности Цензора и
 * Проводника на высоких уровнях.
 */
export function subclassAbilitySources(
  character: Character,
): SubclassAbilitySources {
  const sources: SubclassAbilitySources = new Map();
  const className = normalize(character.className);
  const kind = SUBCLASS_KIND_BY_CLASS[className] ?? GENERIC_KIND;
  const subclass = (character.subclass ?? "").trim();
  const level = character.level ?? 1;

  const add = (
    ability: Pick<Ability, "id" | "name" | "source"> | undefined,
    sourceKind: SubclassKind,
    value: string,
  ) => {
    if (!ability || !value.trim()) return;
    const source: SubclassAbilitySource = {
      ...sourceKind,
      value: value.trim(),
      text: `${sourceKind.label} · ${value.trim()}`,
    };
    if (!sources.has(ability.id)) sources.set(ability.id, source);
    const key = abilityKey(ability);
    if (!sources.has(key)) sources.set(key, source);
  };

  // Гранты уровней: только записи с явным подклассом. Обычные гранты класса
  // (без `subclasses`) к подклассу не относятся.
  for (const rule of LEVEL_UP_RULES) {
    if (normalize(rule.className) !== className || rule.level > level) continue;
    for (const grant of rule.grantedAbilities ?? []) {
      const subclasses = grant.subclasses ?? [];
      if (subclasses.length === 0) continue;
      if (
        !subclass ||
        !subclasses.some((item) => normalize(item) === normalize(subclass))
      ) {
        continue;
      }
      for (const abilityId of grant.abilityIds) {
        add(
          ABILITY_COMPENDIUM.find((ability) => ability.id === abilityId),
          kind,
          subclass,
        );
      }
    }
  }

  const domains = selectedDomains(character);

  // Доменные способности первого уровня: в реестре создания они записаны
  // названиями, поэтому ищем карточку своего класса по названию.
  for (const domain of domains) {
    for (const name of DOMAIN_GRANTED_ABILITIES[domain] ?? []) {
      const ability = ABILITY_COMPENDIUM.find(
        (entry) =>
          normalize(entry.className) === className &&
          normalize(entry.name) === normalize(name),
      );
      add(ability, DOMAIN_KIND, domain);
    }
  }

  if (className === normalize("Цензор")) {
    for (const domain of domains) {
      for (const entry of censorDomainAbilities) {
        if (entry.level > level) continue;
        if (normalize(entry.domain) !== normalize(domain)) continue;
        add(
          ABILITY_COMPENDIUM.find((ability) => ability.id === entry.abilityId),
          DOMAIN_KIND,
          entry.domain,
        );
      }
    }
  }

  if (className === normalize("Проводник")) {
    for (const entry of conduitAbilities) {
      if (entry.level > level) continue;
      const domain = domains.find(
        (item) => normalize(item) === normalize(entry.domain),
      );
      if (!domain) continue;
      add(
        ABILITY_COMPENDIUM.find((ability) => ability.id === entry.abilityId),
        DOMAIN_KIND,
        entry.domain,
      );
    }
  }

  return sources;
}

/** Источник конкретной карточки: по id, затем по названию и источнику. */
export function subclassAbilitySource(
  sources: SubclassAbilitySources,
  ability: Pick<Ability, "id" | "name" | "source">,
): SubclassAbilitySource | undefined {
  return sources.get(ability.id) ?? sources.get(abilityKey(ability));
}

export function isSubclassAbility(
  sources: SubclassAbilitySources,
  ability: Pick<Ability, "id" | "name" | "source">,
): boolean {
  return subclassAbilitySource(sources, ability) !== undefined;
}
