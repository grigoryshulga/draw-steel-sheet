import { ABILITY_COMPENDIUM } from "../data/compendium";
import { LEGACY_ABILITY_IDS } from "../data/originals";
import { kindLabel } from "../data/actions";
import { conduitAbilities } from "../data/class-features/conduit-abilities";
import { CONDUIT_DOMAINS } from "./class-features";
import {
  ALL_CREATION_SKILLS,
  DOMAIN_SKILL_SLOTS,
} from "../data/creation-rules";
import {
  levelUpRule,
  type LevelUpAbilityGroup,
  type LevelUpRule,
} from "../data/level-up-rules";
import {
  CLASS_PERK_LEVELS,
  PERK_COMPENDIUM,
  PERK_TYPE_META,
  classPerkTypes,
  isPerkUsed,
  perkById,
  selectedPerkForSlot,
  type PerkSlot,
} from "../data/perks";
import { SKILL_GROUPS, SKILL_GROUP_TONES } from "../data/skills";
import {
  CHARACTERISTIC_KEYS,
  type Ability,
  type Character,
  type CharacteristicKey,
  type CompendiumAbility,
  type LevelAdvancementRecord,
  type PerkType,
  type SelectedPerk,
} from "../types";
import {
  classFeatureGroupsForSheet,
  type FeatureSheetItem,
} from "./class-feature-view";
import {
  MAX_CHARACTER_LEVEL,
  getLevelUpPlan,
  previewLevelUp,
  type LevelUpPlan,
  type LevelUpRequest,
} from "./level-up";
import { echelon } from "./progression";
import { CHARACTERISTICS } from "./rules";

/* ------------------------------------------------------------------ *
 * Развитие героя: один план на все уровни.
 *
 * Вкладка «Развитие» показывает уровни 1..N (уже полученные) и уровень
 * N+1 (следующий). Внутри уровня выборы разложены на шаги: заголовок
 * говорит, что сделать, под ним — карточки способностей и перков или
 * чипы навыков.
 *
 * Всё, что делает игрок, копится в черновике (`DevelopmentDraft`):
 * карта «шаг → выбранные id». Черновик хранит только отличия от
 * текущего состояния героя, поэтому его можно сбросить и он не мешает
 * правкам листа, сделанным в других панелях.
 * ------------------------------------------------------------------ */

export type DevelopmentStepKind =
  | "ability"
  | "perk"
  | "skill"
  | "characteristic";

export type DevelopmentLevelStatus = "sealed" | "applied" | "next";

/** Один вариант выбора: карточка способности/перка, чип навыка. */
export interface DevelopmentOption {
  id: string;
  label: string;
  /** Короткая подпись над названием: «Героическая способность», «Перк ремесла». */
  tag?: string;
  summary?: string;
  /** Полный текст для поп-апа. */
  detail?: string;
  /** Карточка способности целиком: попап и сетка показывают её поля. */
  ability?: Ability;
  /** Тип перка: по нему карточка выбирает тон и подпись чипа. */
  perkType?: PerkType;
  /** Текущее значение характеристики для подписи варианта. */
  value?: number;
  /** Вариант был выбран раньше и сейчас недоступен для нового выбора. */
  locked?: boolean;
}

/** Шаг уровня: что нужно сделать и из чего выбирать. */
export interface DevelopmentStep {
  /** Уникальный ключ шага во всей вкладке: `l4:skill`. */
  id: string;
  /** Идентификатор выбора внутри правил уровня: `skill`, `perk`, `characteristic`, `conduit.…`. */
  choiceId: string;
  kind: DevelopmentStepKind;
  /** «Выбор способности», «Выбор перка», «Выбор навыка», «Повышение характеристики». */
  title: string;
  /** Подпись правила: «Способность 4-го уровня · Экзорцист». */
  hint?: string;
  count: number;
  required: boolean;
  /** Текущий выбор героя: с него начинается черновик. */
  current: string[];
  options: DevelopmentOption[];
  note?: string;
}

/** Способность, которую уровень выдаёт сам, без выбора. */
export interface DevelopmentGrant {
  id: string;
  name: string;
  summary?: string;
  ability?: Ability;
}

/** Строка сводки уровня 1: то, что задано созданием героя. */
export interface DevelopmentFixedRow {
  label: string;
  values: string[];
}

export interface DevelopmentLevel {
  level: number;
  status: DevelopmentLevelStatus;
  title: string;
  echelonLabel: string;
  ruleTitle?: string;
  steps: DevelopmentStep[];
  /** Особенности класса этого уровня: карточки из реестра механик. */
  features: FeatureSheetItem[];
  /** Особенности, которые появятся на следующем уровне. */
  upcoming: { id: string; name: string; summary?: string; detail?: string }[];
  granted: DevelopmentGrant[];
  fixed: DevelopmentFixedRow[];
  note?: string;
}

export interface DevelopmentPlan {
  levels: DevelopmentLevel[];
  /** Следующий уровень: без него повышение уже недоступно. */
  nextLevel?: { level: number; plan: LevelUpPlan };
  /** Черновик: ключ шага → выбранные id. Только отличия от `current`. */
  issues: string[];
}

export type DevelopmentDraft = Record<string, string[]>;

export interface DevelopmentInput {
  draft: DevelopmentDraft;
}

export interface DevelopmentIssue {
  level: number;
  stepId?: string;
  message: string;
}

export interface DevelopmentResult {
  ok: boolean;
  issues: string[];
  next: Character;
  /** Сохранение подняло героя на следующий уровень. */
  leveledUp: boolean;
}

const COMPENDIUM_BY_ID = new Map<string, CompendiumAbility>(
  ABILITY_COMPENDIUM.flatMap((ability) => {
    const rows: [string, CompendiumAbility][] = [[ability.id, ability]];
    for (const [legacyId, canonicalId] of Object.entries(LEGACY_ABILITY_IDS)) {
      if (canonicalId === ability.id) rows.push([legacyId, ability]);
    }
    return rows;
  }),
);

/** Сравнение имён: регистр, крайние пробелы и ё/е не различают навыки. */
function normalizeToken(value: unknown): string {
  return typeof value === "string"
    ? value.trim().toLowerCase().replace(/ё/g, "е")
    : "";
}

/** Одна и та же напечатанная способность сохраняет личность при смене id. */
function ownershipKey(name: unknown, source: unknown): string {
  return `${normalizeToken(name)}|${normalizeToken(source)}`;
}

function subclassTokens(subclass: string | undefined): string[] {
  return (typeof subclass === "string" ? subclass : "")
    .split(",")
    .map(normalizeToken)
    .filter(Boolean);
}

function appliesToSubclass(
  scoped: string[] | undefined,
  tokens: string[],
): boolean {
  if (!Array.isArray(scoped) || scoped.length === 0) return true;
  return scoped.some((name) => tokens.includes(normalizeToken(name)));
}

function characteristicValue(
  character: Character,
  key: CharacteristicKey,
): number {
  const value = character.characteristics?.[key];
  return Number.isFinite(value) ? Number(value) : 0;
}

function isCharacteristicKey(value: string | undefined): value is CharacteristicKey {
  return (
    typeof value === "string" &&
    (CHARACTERISTIC_KEYS as readonly string[]).includes(value)
  );
}

/**
 * Уровни справочника, из которых группа может брать способности: ровно
 * уровень повышения плюс явно разрешённые правилом прошлые уровни.
 */
function abilityGroupLevels(
  group: LevelUpAbilityGroup,
  level: number,
): number[] {
  const levels = new Set<number>([level]);
  const declared: unknown = group.allowedLevels;
  if (Array.isArray(declared)) {
    for (const value of declared) {
      if (
        typeof value === "number" &&
        Number.isSafeInteger(value) &&
        value >= 1 &&
        value <= level
      ) {
        levels.add(value);
      }
    }
  }
  return [...levels].sort((left, right) => left - right);
}

/** Способность класса из справочника строго для этих уровней. */
function classAbilityOf(
  id: string,
  className: string,
  levels: number[],
): CompendiumAbility | undefined {
  const entry = COMPENDIUM_BY_ID.get(id);
  if (!entry) return undefined;
  if (entry.sourceKind !== "class" || entry.className !== className) {
    return undefined;
  }
  return levels.includes(entry.level) ? entry : undefined;
}

function ownedAbilityKeys(character: Character): {
  ids: Set<string>;
  keys: Set<string>;
} {
  const ids = new Set<string>();
  const keys = new Set<string>();
  for (const ability of Array.isArray(character.abilities)
    ? character.abilities
    : []) {
    if (!ability) continue;
    if (typeof ability.id === "string") ids.add(ability.id);
    if (ability.name || ability.source) {
      keys.add(ownershipKey(ability.name, ability.source));
    }
  }
  return { ids, keys };
}

function abilityTag(entry: CompendiumAbility): string | undefined {
  const parts = [kindLabel(entry.kind)];
  if (entry.className) parts.push(entry.className);
  if (entry.level > 1) parts.push(`${entry.level}-й уровень`);
  return parts.filter(Boolean).join(" · ");
}

function abilityOption(entry: CompendiumAbility): DevelopmentOption {
  const flavour = entry.flavor || entry.trigger;
  return {
    id: entry.id,
    label: entry.name,
    tag: abilityTag(entry),
    summary: flavour || entry.effect.split(/\n{2,}/)[0],
    detail: entry.effect,
    ability: entry,
  };
}

function characteristicOptions(
  character: Character,
  cap: number,
  amount: number,
  current: string[],
): DevelopmentOption[] {
  const currentKeys = new Set(current);
  return CHARACTERISTICS.filter(
    (characteristic) =>
      characteristicValue(character, characteristic.key) < cap ||
      currentKeys.has(characteristic.key),
  ).map((characteristic) => {
    const value = characteristicValue(character, characteristic.key);
    return {
      id: characteristic.key,
      label: characteristic.label,
      tag: `сейчас ${value}`,
      summary: `+${amount} к характеристике, но не выше ${cap}`,
    };
  });
}

/* --------------------------- навыки --------------------------- */

interface SkillChipMeta {
  tone: "yellow" | "green" | "blue" | "magenta" | "accent";
  group: string;
}

/** Тон чипа навыка по его группе — как в панели навыков листа. */
export function skillChipMeta(skill: string): SkillChipMeta {
  const group = SKILL_GROUPS.find((entry) => entry.skills.includes(skill));
  if (!group) return { tone: "accent", group: "Другие" };
  return { tone: SKILL_GROUP_TONES[group.key], group: group.label };
}

function skillOptions(
  character: Character,
  current: string[],
  pool: readonly string[] = ALL_CREATION_SKILLS,
): DevelopmentOption[] {
  const learned = new Set(
    (Array.isArray(character.skills) ? character.skills : []).map(normalizeToken),
  );
  const currentKeys = new Set(current.map(normalizeToken));
  const seen = new Set<string>();
  const options: DevelopmentOption[] = [];
  for (const skill of pool) {
    const key = normalizeToken(skill);
    if (seen.has(key)) continue;
    if (learned.has(key) && !currentKeys.has(key)) continue;
    seen.add(key);
    const meta = skillChipMeta(skill);
    options.push({ id: skill, label: skill, tag: meta.group });
  }
  return options;
}

/**
 * Навыки, которые герой получил не на повышении уровня: их нельзя снимать,
 * когда игрок меняет выбор шага «Выбор навыка». Всё, что не занято записями
 * повышений, пришло из происхождения, культуры, карьеры или класса.
 */
/** Пара доменов Проводника: сохранённый выбор или подкласс. */
function conduitDomainPair(character: Character): string[] {
  const raw = character.automation?.classFeatureSelections?.["conduit.domain"];
  const value = typeof raw === "string" ? raw : character.subclass;
  return String(value ?? "")
    .split(",")
    .map((part) => part.trim())
    .map((part) =>
      CONDUIT_DOMAINS.find((domain) => normalizeToken(domain) === normalizeToken(part)),
    )
    .filter((domain): domain is string => !!domain);
}

function creationSkillPool(character: Character): Set<string> {
  const fromRecords = recordPickSets(character).skills;
  const pool = new Set<string>();
  for (const skill of Array.isArray(character.skills) ? character.skills : []) {
    const key = normalizeToken(skill);
    if (!fromRecords.has(key)) pool.add(key);
  }
  return pool;
}

/* --------------------------- план --------------------------- */

function recordsOf(character: Character): LevelAdvancementRecord[] {
  return Array.isArray(character.advancements)
    ? character.advancements.filter((record) => !!record)
    : [];
}

function recordForLevel(
  character: Character,
  level: number,
): LevelAdvancementRecord | undefined {
  const matches = recordsOf(character).filter(
    (record) =>
      record.toLevel === level &&
      (!record.className || record.className === character.className),
  );
  return matches[matches.length - 1];
}

/**
 * Все id, занятые записями повышений. `exceptLevel` исключает запись того
 * уровня, который сейчас правят: иначе шаг не смог бы снять свой же выбор.
 */
function recordPickSets(
  character: Character,
  exceptLevel?: number,
): {
  abilities: Set<string>;
  skills: Set<string>;
} {
  const abilities = new Set<string>();
  const skills = new Set<string>();
  const skillKeys = new Set(ALL_CREATION_SKILLS.map(normalizeToken));
  for (const record of recordsOf(character)) {
    if (
      typeof exceptLevel === "number" &&
      record.toLevel === exceptLevel &&
      (!record.className || record.className === character.className)
    ) {
      continue;
    }
    const choices = record.choices ?? {};
    for (const ids of Object.values(choices)) {
      for (const id of ids ?? []) {
        if (COMPENDIUM_BY_ID.has(id)) abilities.add(id);
        else if (skillKeys.has(normalizeToken(id))) skills.add(normalizeToken(id));
      }
    }
  }
  return { abilities, skills };
}

function levelTitle(level: number): string {
  return `${level}-й уровень`;
}

function perkSlotFor(character: Character, level: number): PerkSlot | undefined {
  if (!(CLASS_PERK_LEVELS as readonly number[]).includes(level)) return undefined;
  return {
    key: `class-${level}`,
    source: "class",
    level,
    title: `Класс · ${level} уровень`,
    allowedTypes: classPerkTypes(character.className, level),
  };
}

function perkOptions(
  character: Character,
  slot: PerkSlot,
  currentPerk: SelectedPerk | undefined,
): DevelopmentOption[] {
  const options: DevelopmentOption[] = PERK_COMPENDIUM.filter(
    (perk) =>
      slot.allowedTypes.includes(perk.type) &&
      !isPerkUsed(character, perk.id, slot),
  ).map((perk) => ({
    id: perk.id,
    label: perk.name,
    tag: PERK_TYPE_META[perk.type].label,
    summary: perk.summary || perk.description,
    detail: perk.description,
    perkType: perk.type,
  }));
  if (currentPerk) {
    const index = options.findIndex((option) => option.id === currentPerk.perkId);
    if (index > 0) options.unshift(...options.splice(index, 1));
    if (index < 0) {
      options.unshift({
        id: currentPerk.perkId,
        label: currentPerk.name,
        tag: "выбран сейчас",
        perkType: currentPerk.type,
        ...(currentPerk.summary ? { summary: currentPerk.summary } : {}),
        ...(currentPerk.description ? { detail: currentPerk.description } : {}),
      });
    }
  }
  return options;
}

/**
 * Выборы уже полученного уровня. В отличие от диалога повышения здесь
 * нельзя выкидывать уже выбранные способности: они и есть текущий выбор.
 */
function appliedLevelSteps(
  character: Character,
  level: number,
  rule: LevelUpRule,
  record: LevelAdvancementRecord | undefined,
): DevelopmentStep[] {
  const steps: DevelopmentStep[] = [];
  const prior = record?.choices ?? {};
  const tokens = subclassTokens(character.subclass);
  const owned = ownedAbilityKeys(character);
  const required = !!record;

  const add = (step: Omit<DevelopmentStep, "id" | "required">) => {
    steps.push({
      ...step,
      id: `l${level}:${step.choiceId}`,
      required,
    });
  };

  const characteristicSpec = rule.characteristics?.choice;
  if (characteristicSpec) {
    const { amount, cap } = characteristicSpec;
    if (Number.isFinite(amount) && amount > 0 && Number.isFinite(cap)) {
      const current = prior["characteristic"] ?? [];
      const options = characteristicOptions(character, cap, amount, current);
      if (options.length > 0) {
        add({
          choiceId: "characteristic",
          kind: "characteristic",
          title: "Повышение характеристики",
          hint: `+${amount}, не выше ${cap}`,
          count: 1,
          current,
          options,
        });
      }
    }
  }

  for (const group of rule.abilityChoices) {
    if (!appliesToSubclass(group.subclasses, tokens)) continue;
    const count =
      Number.isSafeInteger(group.count) && group.count > 0 ? group.count : 0;
    if (count === 0) continue;
    const current = prior[group.id] ?? [];
    const currentIds = new Set(current);
    const levels = abilityGroupLevels(group, level);
    const options: DevelopmentOption[] = [];
    const seenIds = new Set<string>();
    const seenKeys = new Set<string>();
    for (const id of group.abilityIds ?? []) {
      const entry = classAbilityOf(id, character.className, levels);
      if (!entry) continue;
      const key = ownershipKey(entry.name, entry.source);
      if (seenIds.has(entry.id) || seenKeys.has(key)) continue;
      const isOwned = owned.ids.has(entry.id) || owned.keys.has(key);
      if (isOwned && !currentIds.has(entry.id)) continue;
      seenIds.add(entry.id);
      seenKeys.add(key);
      options.push(abilityOption(entry));
    }
    if (options.length === 0) continue;
    add({
      choiceId: group.id,
      kind: "ability",
      title: "Выбор способности",
      hint: group.label,
      count,
      current,
      options,
    });
  }

  // Доменные выборы Проводника: способность домена на 2/6/9 и навык
  // второго домена на 2-м уровне. В правилах они живут отдельными ключами.
  if (character.className === "Проводник") {
    const domainAbilityKey = `conduit.ability.domain.${level}`;
    if (prior[domainAbilityKey]) {
      const current = prior[domainAbilityKey] ?? [];
      const currentIds = new Set(current);
      const options: DevelopmentOption[] = [];
      // Доменная способность берётся только из пары доменов героя, иначе
      // вкладка предлагала бы способности чужих доменов.
      const pair = conduitDomainPair(character);
      for (const mapping of conduitAbilities.filter(
        (entry) =>
          entry.level === level &&
          (pair.length === 0 ||
            pair.some((domain) => normalizeToken(domain) === normalizeToken(entry.domain))),
      )) {
        const entry = COMPENDIUM_BY_ID.get(mapping.abilityId);
        if (!entry) continue;
        const key = ownershipKey(entry.name, entry.source);
        const isOwned = owned.ids.has(entry.id) || owned.keys.has(key);
        if (isOwned && !currentIds.has(entry.id)) continue;
        options.push({ ...abilityOption(entry), tag: `Домен: ${mapping.domain}` });
      }
      if (options.length > 0) {
        add({
          choiceId: domainAbilityKey,
          kind: "ability",
          title: "Выбор доменной способности",
          hint: `Доменная способность ${level}-го уровня`,
          count: 1,
          current,
          options,
        });
      }
    }
    const domainSkillKey = "conduit.domain.skill.2";
    if (level === 2 && prior[domainSkillKey]) {
      const current = prior[domainSkillKey] ?? [];
      const pool = Object.values(DOMAIN_SKILL_SLOTS).flatMap(
        (slot) => slot.options,
      );
      const options = skillOptions(character, current, pool);
      if (options.length > 0) {
        add({
          choiceId: domainSkillKey,
          kind: "skill",
          title: "Выбор навыка домена",
          hint: "Навык второго домена Проводника",
          count: 1,
          current,
          options,
        });
      }
    }
  }

  const slot = perkSlotFor(character, level);
  if (slot) {
    const currentPerk = selectedPerkForSlot(character, slot);
    const current = currentPerk ? [currentPerk.perkId] : [];
    const options = perkOptions(character, slot, currentPerk);
    if (options.length > 0) {
      add({
        choiceId: "perk",
        kind: "perk",
        title: "Выбор перка",
        hint: `Классовый перк ${level}-го уровня`,
        count: 1,
        current,
        options,
      });
    }
  }

  const skillCount =
    Number.isSafeInteger(rule.skillCount) && rule.skillCount > 0
      ? rule.skillCount
      : 0;
  if (skillCount > 0) {
    const current = prior["skill"] ?? [];
    const options = skillOptions(character, current);
    if (options.length > 0) {
      add({
        choiceId: "skill",
        kind: "skill",
        title: skillCount === 1 ? "Выбор навыка" : `Выбор навыков (${skillCount})`,
        hint: `Правила ${level}-го уровня`,
        count: skillCount,
        current,
        options,
      });
    }
  }

  return steps;
}

function grantedForRule(
  character: Character,
  rule: LevelUpRule,
  level: number,
): DevelopmentGrant[] {
  const tokens = subclassTokens(character.subclass);
  const grants: DevelopmentGrant[] = [];
  for (const grant of rule.grantedAbilities) {
    if (!appliesToSubclass(grant.subclasses, tokens)) continue;
    for (const id of grant.abilityIds ?? []) {
      const entry = classAbilityOf(id, character.className, [level]);
      if (!entry) continue;
      if (grants.some((item) => item.id === entry.id)) continue;
      grants.push({
        id: entry.id,
        name: entry.name,
        summary: entry.effect.split(/\n{2,}/)[0],
        ability: entry,
      });
    }
  }
  return grants;
}

function featuresAtLevel(
  groups: { level: number; features: FeatureSheetItem[] }[],
  level: number,
): FeatureSheetItem[] {
  return (groups.find((group) => group.level === level)?.features ?? []).filter(
    (item) => !item.passive,
  );
}

function fixedRowsForLevelOne(
  character: Character,
  picks: { abilities: Set<string>; skills: Set<string> },
): DevelopmentFixedRow[] {
  const creationSkills = (character.skills ?? []).filter(
    (skill) => !picks.skills.has(normalizeToken(skill)),
  );
  const creationAbilities = (character.abilities ?? [])
    .filter((ability) => !picks.abilities.has(ability.id))
    .map((ability) => ability.name)
    .filter(Boolean);
  const careerPerks = (character.perks ?? [])
    .filter((perk) => perk.source === "career")
    .map((perk) => perk.name);
  const rows: DevelopmentFixedRow[] = [
    { label: "Происхождение", values: [character.ancestry].filter(Boolean) },
    {
      label: "Культура",
      values: [
        character.culture?.environment,
        character.culture?.organization,
        character.culture?.upbringing,
      ].filter(Boolean) as string[],
    },
    {
      label: "Карьера",
      values: [character.career, ...careerPerks].filter(Boolean) as string[],
    },
    {
      label: "Класс",
      values: [character.className, character.subclass].filter(Boolean) as string[],
    },
    { label: "Комплект", values: [character.kit].filter(Boolean) as string[] },
    { label: "Навыки создания", values: creationSkills },
    { label: "Способности создания", values: creationAbilities },
  ];
  return rows.filter((row) => row.values.length > 0);
}

/**
 * Шаги следующего уровня берутся у диалога повышения: те же идентификаторы
 * выборов, та же проверка правил. Так «Развитие» и повышение уровня не
 * расходятся.
 */
function nextLevelSteps(
  character: Character,
  level: number,
  plan: LevelUpPlan,
): DevelopmentStep[] {
  return plan.choices.map((choice) => {
    const current: string[] = [];
    if (choice.kind === "perk") {
      const slot = perkSlotFor(character, level);
      const existing = slot ? selectedPerkForSlot(character, slot) : undefined;
      if (existing) current.push(existing.perkId);
    }
    const options: DevelopmentOption[] = choice.options.map((option) => {
      if (choice.kind === "ability") {
        const entry = COMPENDIUM_BY_ID.get(option.id);
        if (entry) return abilityOption(entry);
      }
      if (choice.kind === "perk") {
        const perk = perkById(option.id);
        if (perk) {
          return {
            id: perk.id,
            label: perk.name,
            tag: PERK_TYPE_META[perk.type].label,
            summary: perk.summary || perk.description,
            detail: perk.description,
            perkType: perk.type,
          };
        }
      }
      if (choice.kind === "characteristic" && isCharacteristicKey(option.id)) {
        return {
          ...option,
          tag: `сейчас ${characteristicValue(character, option.id)}`,
        };
      }
      if (choice.kind === "skill") {
        return { ...option, tag: skillChipMeta(option.id).group };
      }
      return { ...option };
    });
    // Шаг следующего уровня обязателен только вместе с самим повышением:
    // иначе правка прошлых уровней требовала бы заодно поднять героя.
    return {
      id: `l${level}:${choice.id}`,
      choiceId: choice.id,
      kind: choice.kind,
      required: false,
      title:
        choice.kind === "perk"
          ? "Выбор перка"
          : choice.kind === "skill"
            ? choice.count === 1
              ? "Выбор навыка"
              : `Выбор навыков (${choice.count})`
            : choice.kind === "characteristic"
              ? "Повышение характеристики"
              : "Выбор способности",
      hint: choice.label,
      count: choice.count,
      current,
      options,
    };
  });
}

/** Собирает всё, что показывает вкладка «Развитие». */
export function buildDevelopmentPlan(character: Character): DevelopmentPlan {
  const rawLevel = Number.isFinite(character.level) ? Number(character.level) : 1;
  const level = Math.max(
    1,
    Math.min(MAX_CHARACTER_LEVEL, Math.floor(rawLevel)),
  );
  const issues: string[] = [];
  const picks = recordPickSets(character);
  const groups = classFeatureGroupsForSheet(character);
  const levels: DevelopmentLevel[] = [];

  levels.push({
    level: 1,
    status: "sealed",
    title: levelTitle(1),
    echelonLabel: `${echelon(1)}-й эшелон`,
    steps: [],
    features: featuresAtLevel(groups, 1),
    upcoming: [],
    granted: [],
    fixed: fixedRowsForLevelOne(character, picks),
    note: "Создание героя: эти выборы заданы при первом заполнении листа.",
  });

  for (let current = 2; current <= level; current += 1) {
    const rule = levelUpRule(character.className, current);
    const record = recordForLevel(character, current);
    const steps = rule
      ? appliedLevelSteps(character, current, rule, record)
      : [];
    levels.push({
      level: current,
      status: "applied",
      title: levelTitle(current),
      echelonLabel: `${echelon(current)}-й эшелон`,
      ...(rule ? { ruleTitle: rule.title } : {}),
      steps,
      features: featuresAtLevel(groups, current),
      upcoming: [],
      granted: rule ? grantedForRule(character, rule, current) : [],
      fixed: [],
      ...(rule
        ? record
          ? {}
          : {
              note:
                "Записи о повышении этого уровня нет: выборы можно дозаполнить, они сохранятся как запись о повышении.",
            }
        : {
            note: `Для класса «${character.className}» нет проверенных правил ${current}-го уровня.`,
          }),
    });
  }

  let nextLevel: DevelopmentPlan["nextLevel"];
  if (level < MAX_CHARACTER_LEVEL) {
    const plan = getLevelUpPlan(character);
    const nextNumber = plan.toLevel;
    if (plan.available) {
      const steps = nextLevelSteps(character, nextNumber, plan);
      const covered = new Set(plan.classFeatures.map((feature) => feature.name));
      const upcoming = plan.rule
        ? plan.rule.features
            .filter((feature) => !covered.has(feature.name))
            .map((feature) => ({
              id: feature.id,
              name: feature.name,
              detail: feature.description,
            }))
        : [];
      levels.push({
        level: nextNumber,
        status: "next",
        title: levelTitle(nextNumber),
        echelonLabel: `${echelon(nextNumber)}-й эшелон`,
        ...(plan.rule ? { ruleTitle: plan.rule.title } : {}),
        steps,
        features: [],
        upcoming: [
          ...plan.classFeatures.map((feature) => ({
            id: feature.id,
            name: feature.name,
            summary: feature.summary,
          })),
          ...upcoming,
        ],
        granted: plan.grantedAbilityIds
          .map((id) => COMPENDIUM_BY_ID.get(id))
          .filter((entry): entry is CompendiumAbility => !!entry)
          .map((entry) => ({
            id: entry.id,
            name: entry.name,
            summary: entry.effect.split(/\n{2,}/)[0],
            ability: entry,
          })),
        fixed: [],
        ...(plan.warnings.length > 0 ? { note: plan.warnings.join(" ") } : {}),
      });
      nextLevel = { level: nextNumber, plan };
      for (const issue of plan.warnings) issues.push(issue);
    } else {
      levels.push({
        level: nextNumber,
        status: "next",
        title: levelTitle(nextNumber),
        echelonLabel: `${echelon(nextNumber)}-й эшелон`,
        steps: [],
        features: [],
        upcoming: [],
        granted: [],
        fixed: [],
        note: plan.reason ?? "Повышение уровня недоступно.",
      });
    }
  } else {
    issues.push(`Герой достиг ${MAX_CHARACTER_LEVEL}-го уровня — расти дальше нельзя.`);
  }

  return { levels, ...(nextLevel ? { nextLevel } : {}), issues };
}

/* --------------------------- черновик --------------------------- */

export function stepSelection(
  step: DevelopmentStep,
  draft: DevelopmentDraft,
): string[] {
  const override = draft[step.id];
  return Array.isArray(override) ? override : step.current;
}

/** Выбор шага → карта «шаг → итоговый выбор» для применения. */
export function developmentSelections(
  plan: DevelopmentPlan,
  draft: DevelopmentDraft,
): Map<string, string[]> {
  const selections = new Map<string, string[]>();
  for (const level of plan.levels) {
    for (const step of level.steps) {
      selections.set(step.id, stepSelection(step, draft));
    }
  }
  return selections;
}

function sameSelection(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  const rightSet = new Set(right);
  return left.every((value) => rightSet.has(value));
}

/** Черновик отличается от текущего состояния героя. */
export function draftIsDirty(
  plan: DevelopmentPlan,
  draft: DevelopmentDraft,
): boolean {
  for (const level of plan.levels) {
    for (const step of level.steps) {
      const override = draft[step.id];
      if (!Array.isArray(override)) continue;
      if (!sameSelection(override, step.current)) return true;
    }
  }
  return false;
}

/** Выбор следующего уровня начат: тогда он должен быть завершён целиком. */
export function nextLevelEngaged(
  plan: DevelopmentPlan,
  draft: DevelopmentDraft,
): boolean {
  const next = plan.levels.find((level) => level.status === "next");
  if (!next) return false;
  return next.steps.some((step) => stepSelection(step, draft).length > 0);
}

function stepLabel(step: DevelopmentStep): string {
  return step.count > 1 ? `${step.title} (${step.count})` : step.title;
}

/** Что мешает сохранению: незаполненные обязательные шаги и запреты правил. */
export function developmentIssues(
  plan: DevelopmentPlan,
  input: DevelopmentInput,
): DevelopmentIssue[] {
  const issues: DevelopmentIssue[] = [];
  const selections = developmentSelections(plan, input.draft);
  // Одна способность не может достаться двум шагам сразу, даже если это шаги
  // разных уровней: иначе запись уровня обещала бы награду, которой нет.
  const pickedAbilities = new Set<string>();

  for (const level of plan.levels) {
    for (const step of level.steps) {
      const selected = selections.get(step.id) ?? [];
      if (selected.length !== 0 && selected.length !== step.count) {
        issues.push({
          level: level.level,
          stepId: step.id,
          message: `${levelTitle(level.level)}: «${stepLabel(step)}» — нужно выбрать ${step.count}, выбрано ${selected.length}.`,
        });
        continue;
      }
      if (step.required && selected.length === 0) {
        issues.push({
          level: level.level,
          stepId: step.id,
          message: `${levelTitle(level.level)}: не заполнен шаг «${stepLabel(step)}».`,
        });
        continue;
      }
      if (step.kind === "ability") {
        for (const id of selected) {
          if (pickedAbilities.has(id)) {
            issues.push({
              level: level.level,
              stepId: step.id,
              message: `${levelTitle(level.level)}: способность выбрана дважды в разных шагах.`,
            });
          } else {
            pickedAbilities.add(id);
          }
        }
      }
      for (const id of selected) {
        if (
          step.kind !== "characteristic" &&
          !step.options.some((option) => option.id === id)
        ) {
          issues.push({
            level: level.level,
            stepId: step.id,
            message: `${levelTitle(level.level)}: вариант «${id}» больше не входит в «${step.title}». Выберите заново.`,
          });
        }
      }
    }
  }

  const next = plan.levels.find((level) => level.status === "next");
  if (next && plan.nextLevel) {
    const engaged = next.steps.some(
      (step) => (selections.get(step.id) ?? []).length > 0,
    );
    if (engaged) {
      for (const step of next.steps) {
        if ((selections.get(step.id) ?? []).length === 0) {
          issues.push({
            level: next.level,
            stepId: step.id,
            message: `${levelTitle(next.level)}: не заполнен шаг «${stepLabel(step)}».`,
          });
        }
      }
    }
  }
  return issues;
}

/* --------------------------- применение --------------------------- */

function cloneAbility(entry: Ability): Ability {
  return {
    id: entry.id,
    name: entry.name,
    flavor: entry.flavor ?? "",
    actionType: entry.actionType,
    kind: entry.kind,
    keywords: Array.isArray(entry.keywords) ? [...entry.keywords] : [],
    ...(entry.weaponMode ? { weaponMode: entry.weaponMode } : {}),
    distance: entry.distance ?? "",
    target: entry.target ?? "",
    rollCharacteristics: Array.isArray(entry.rollCharacteristics)
      ? [...entry.rollCharacteristics]
      : [],
    preferredCharacteristic: entry.preferredCharacteristic ?? "",
    rollBonus: entry.rollBonus ?? 0,
    resourceCost: entry.resourceCost ?? 0,
    trigger: entry.trigger ?? "",
    tiers: (Array.isArray(entry.tiers) ? entry.tiers : []).map((tier) => ({
      damage: tier?.damage ?? "",
      effect: tier?.effect ?? "",
    })) as Ability["tiers"],
    effect: entry.effect ?? "",
    source: entry.source ?? "",
    notes: entry.notes ?? "",
  };
}

function removeAbility(abilities: Ability[], id: string): Ability[] {
  const entry = COMPENDIUM_BY_ID.get(id);
  const key = entry ? ownershipKey(entry.name, entry.source) : undefined;
  return abilities.filter((ability) => {
    if (ability.id === id) return false;
    if (key && ownershipKey(ability.name, ability.source) === key) return false;
    return true;
  });
}

function applyClassPerk(
  perks: SelectedPerk[],
  level: number,
  perkId: string | undefined,
): SelectedPerk[] {
  const withoutSlot = perks.filter(
    (perk) => !(perk.source === "class" && perk.level === level),
  );
  if (!perkId) return withoutSlot;
  const perk = perkById(perkId);
  if (!perk) return perks;
  return [
    ...withoutSlot,
    {
      perkId: perk.id,
      name: perk.name,
      type: perk.type,
      source: "class" as const,
      level,
    },
  ];
}

function cloneRecord(record: LevelAdvancementRecord): LevelAdvancementRecord {
  const choices: Record<string, string[]> = {};
  for (const [key, ids] of Object.entries(record.choices ?? {})) {
    choices[key] = Array.isArray(ids) ? [...ids] : [];
  }
  return { ...record, choices };
}

/**
 * Применяет черновик. Уже полученные уровни меняются точечно: снимается
 * старый выбор шага и добавляется новый, остальные способности, перки и
 * навыки героя не пересобираются. Следующий уровень идёт через
 * `previewLevelUp`, чтобы проверка правил осталась одной.
 */
export function applyDevelopment(
  character: Character,
  plan: DevelopmentPlan,
  input: DevelopmentInput,
): DevelopmentResult {
  const issues = developmentIssues(plan, input).map((issue) => issue.message);
  if (issues.length > 0) {
    return { ok: false, issues, next: character, leveledUp: false };
  }

  const selections = developmentSelections(plan, input.draft);
  let abilities = (character.abilities ?? []).map((ability) => ({ ...ability }));
  let skills = [...(character.skills ?? [])];
  let perks = (character.perks ?? []).map((perk) => ({ ...perk }));
  const characteristics = { ...(character.characteristics ?? {}) } as Record<
    CharacteristicKey,
    number
  >;
  for (const key of CHARACTERISTIC_KEYS) {
    if (!Number.isFinite(characteristics[key])) characteristics[key] = 0;
  }

  const records = recordsOf(character).map(cloneRecord);
  // Домен выбранной способности Проводника отмечается в automation: по нему
  // лист решает, какие доменные особенности уровня считать активными.
  const domainMarkers: Record<string, string> = {};
  const creationSkills = creationSkillPool(character);
  let placedAbilities = new Set(abilities.map((ability) => ability.id));

  interface StepChange {
    step: DevelopmentStep;
    chosen: string[];
    previous: string[];
  }
  interface LevelEdit {
    level: number;
    rule: LevelUpRule | undefined;
    recordIndex: number;
    otherPicks: { abilities: Set<string>; skills: Set<string> };
    changes: StepChange[];
    record: LevelAdvancementRecord;
  }

  // Сначала собираем правки уровней, чтобы применить их одним проходом:
  // обмен способностями между уровнями не должен зависеть от их порядка.
  const edits: LevelEdit[] = [];
  for (const level of plan.levels) {
    if (level.status !== "applied") continue;
    const rule = levelUpRule(character.className, level.level);
    const recordIndex = records.findIndex(
      (record) =>
        record.toLevel === level.level &&
        (!record.className || record.className === character.className),
    );
    const recordChoices: Record<string, string[]> =
      recordIndex >= 0 ? { ...records[recordIndex].choices } : {};
    const changes: StepChange[] = [];
    for (const step of level.steps) {
      const chosen = selections.get(step.id) ?? [];
      if (sameSelection(chosen, step.current)) continue;
      changes.push({ step, chosen, previous: step.current });
      if (chosen.length > 0) recordChoices[step.choiceId] = [...chosen];
      else delete recordChoices[step.choiceId];
    }
    if (recordIndex < 0 && changes.length === 0) continue;
    const current = recordIndex >= 0 ? records[recordIndex] : undefined;
    edits.push({
      level: level.level,
      rule,
      recordIndex,
      otherPicks: recordPickSets(character, level.level),
      changes,
      record: {
        fromLevel: Math.max(1, level.level - 1),
        toLevel: level.level,
        className: character.className,
        subclass: typeof character.subclass === "string" ? character.subclass : "",
        articleId: current?.articleId ?? rule?.articleId ?? "",
        choices: recordChoices,
        notes: current?.notes ?? "Дозаполнено в «Развитии»",
        createdAt: current?.createdAt ?? new Date().toISOString(),
      },
    });
  }

  // Снятие старых выборов идёт раньше добавления новых: способность, которую
  // один уровень отдаёт, другой может забрать в том же сохранении.
  for (const edit of edits) {
    for (const { step, chosen, previous } of edit.changes) {
      if (step.kind === "ability") {
        const chosenSet = new Set(chosen);
        for (const id of previous) {
          if (chosenSet.has(id)) continue;
          if (edit.otherPicks.abilities.has(id)) continue;
          abilities = removeAbility(abilities, id);
        }
      }
      if (step.kind === "skill") {
        const chosenKeys = chosen.map(normalizeToken);
        for (const skill of previous) {
          const key = normalizeToken(skill);
          if (chosenKeys.includes(key)) continue;
          if (creationSkills.has(key) || edit.otherPicks.skills.has(key)) continue;
          skills = skills.filter((owned) => normalizeToken(owned) !== key);
        }
      }
    }
  }
  placedAbilities = new Set(abilities.map((ability) => ability.id));

  for (const edit of edits) {
    for (const { step, chosen, previous } of edit.changes) {
      if (step.kind === "ability") {
        for (const id of chosen) {
          if (previous.includes(id)) continue;
          const entry = COMPENDIUM_BY_ID.get(id);
          if (!entry) continue;
          if (placedAbilities.has(entry.id)) continue;
          abilities.push(cloneAbility(entry));
          placedAbilities.add(entry.id);
        }
        if (step.choiceId.startsWith("conduit.ability.domain.")) {
          const mapping = conduitAbilities.find(
            (entry) => entry.level === edit.level && entry.abilityId === chosen[0],
          );
          if (mapping) domainMarkers[step.choiceId] = mapping.domain;
        }
      }

      if (step.kind === "skill") {
        for (const skill of chosen) {
          if (previous.some((old) => normalizeToken(old) === normalizeToken(skill))) {
            continue;
          }
          if (!skills.some((owned) => normalizeToken(owned) === normalizeToken(skill))) {
            skills.push(skill);
          }
        }
      }

      if (step.kind === "perk") {
        perks = applyClassPerk(perks, edit.level, chosen[0]);
      }

      if (step.kind === "characteristic" && edit.rule?.characteristics?.choice) {
        const { amount, cap } = edit.rule.characteristics.choice;
        const oldKey = previous[0];
        const newKey = chosen[0];
        if (isCharacteristicKey(oldKey) && oldKey !== newKey) {
          characteristics[oldKey] = Math.max(
            0,
            (characteristics[oldKey] ?? 0) - amount,
          );
        }
        if (isCharacteristicKey(newKey) && newKey !== oldKey) {
          characteristics[newKey] = Math.max(
            characteristics[newKey] ?? 0,
            Math.min(cap, (characteristics[newKey] ?? 0) + amount),
          );
        }
      }
    }

    if (edit.recordIndex >= 0) records[edit.recordIndex] = edit.record;
    else records.push(edit.record);
  }

  let next: Character = {
    ...character,
    abilities,
    skills,
    perks,
    characteristics,
    advancements: records,
  };

  if (Object.keys(domainMarkers).length > 0 && next.automation) {
    next = {
      ...next,
      automation: {
        ...next.automation,
        classFeatureSelections: {
          ...(next.automation.classFeatureSelections ?? {}),
          ...domainMarkers,
        },
      },
    };
  }

  const nextLevel = plan.nextLevel;
  const nextSection = plan.levels.find((level) => level.status === "next");
  const engaged =
    !!nextLevel &&
    !!nextSection &&
    nextSection.steps.some(
      (step) => (selections.get(step.id) ?? []).length > 0,
    );

  if (nextLevel && engaged) {
    const choices: Record<string, string[]> = {};
    for (const step of nextSection!.steps) {
      const chosen = selections.get(step.id) ?? [];
      if (chosen.length === 0) continue;
      choices[step.choiceId] = [...chosen];
    }
    const request: LevelUpRequest = {
      characterId: next.id,
      fromLevel: next.level,
      className: next.className,
      subclass: next.subclass ?? "",
      choices,
    };
    const preview = previewLevelUp(next, request);
    if (!preview.ok) {
      return {
        ok: false,
        issues: preview.issues,
        next: character,
        leveledUp: false,
      };
    }
    next = preview.next;
  }

  return {
    ok: true,
    issues: [],
    next,
    leveledUp: !!nextLevel && engaged,
  };
}
