import { ABILITY_COMPENDIUM } from "../data/compendium";
import { LEGACY_ABILITY_IDS } from "../data/originals";
import { conduitAbilities } from "../data/class-features/conduit-abilities";
import { censorDomainAbilities } from "../data/class-features/censor-abilities";
import { GENERATED_CLASS_FEATURES } from "../data/class-features/skeleton";
import { classPreset } from "../data/classes";
import { ALL_CREATION_SKILLS, DOMAIN_SKILL_SLOTS, DOMAIN_GRANTED_ABILITIES } from "../data/creation-rules";
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
import {
  levelUpRule,
  type LevelUpAbilityGroup,
  type LevelUpFeature,
  type LevelUpRule,
} from "../data/level-up-rules";
import {
  CHARACTERISTIC_KEYS,
  type Ability,
  type Character,
  type CharacteristicKey,
  type CompendiumAbility,
  type LevelAdvancementRecord,
  type SelectedPerk,
} from "../types";
import { recalculateCharacter } from "./character-calculations";
import { classFeatureGiftsAtLevel } from "./class-feature-view";
import { CHARACTERISTICS } from "./rules";
import { selectedGroupValue } from "./feature-conditions";

export type { LevelUpAbilityGroup, LevelUpFeature, LevelUpRule };

/** Draw Steel echelons cap the heroic progression at level ten. */
export const MAX_CHARACTER_LEVEL = 10;
/** Standard cumulative XP: the next level costs sixteen per level after the first. */
export const LEVEL_UP_XP_STEP = 16;

/** Cumulative XP required to be *at* `toLevel`. */
export function levelUpXpRequirement(toLevel: number): number {
  if (!Number.isFinite(toLevel)) return 0;
  return Math.max(0, (Math.floor(toLevel) - 1) * LEVEL_UP_XP_STEP);
}

export interface LevelUpRequest {
  characterId: string;
  fromLevel: number;
  className: string;
  subclass: string;
  mode: "xp" | "milestone";
  choices: Record<string, string[]>;
  reviewedRules: boolean;
  notes?: string;
  manualMaxima?: { stamina?: number; recoveries?: number };
}

export interface LevelUpChoiceOption {
  id: string;
  label: string;
  description?: string;
}

export interface LevelUpChoice {
  id: string;
  kind: "ability" | "perk" | "skill" | "characteristic";
  label: string;
  count: number;
  options: LevelUpChoiceOption[];
}

/** Особенность класса, которую герой получает на новом уровне. */
export interface LevelUpClassFeature {
  id: string;
  name: string;
  level: number;
  /** Подпись та же, что в панели особенностей: «скорость +2 (Ловкость)». */
  summary: string;
}

export interface LevelUpPlan {
  available: boolean;
  reason?: string;
  fromLevel: number;
  toLevel: number;
  xpRequired: number;
  xpMissing: number;
  rule?: LevelUpRule;
  choices: LevelUpChoice[];
  /** Активные особенности ровно нового уровня: их не спрашивают, а показывают. */
  classFeatures: LevelUpClassFeature[];
  grantedAbilityIds: string[];
  warnings: string[];
}

export type LevelUpPreview =
  | { ok: true; next: Character; rawNext: Character; plan: LevelUpPlan }
  | { ok: false; issues: string[]; plan: LevelUpPlan };

interface ResolvedChoice {
  choice: LevelUpChoice;
  required: boolean;
  abilityGroup?: LevelUpAbilityGroup;
  optionOrder: Map<string, number>;
}

interface LevelUpContext {
  plan: LevelUpPlan;
  rule?: LevelUpRule;
  choices: ResolvedChoice[];
  choiceById: Map<string, ResolvedChoice>;
  perkSlot?: PerkSlot;
  existingPerk?: SelectedPerk;
  /** Characteristics after the rule's automatic growth, before the player's choice. */
  grown: Record<CharacteristicKey, number>;
  granted: Ability[];
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Case, surrounding whitespace and ё/е spelling never distinguish two names. */
function normalizeToken(value: string): string {
  return value.trim().toLowerCase().replace(/ё/g, "е");
}

/** Class-owned ability identity: the same printed ability keeps its identity across IDs. */
function abilityOwnershipKey(name: unknown, source: unknown): string {
  const left = normalizeToken(typeof name === "string" ? name : "");
  const right = normalizeToken(typeof source === "string" ? source : "");
  return `${left}|${right}`;
}

interface OwnedAbilities {
  ids: Set<string>;
  keys: Set<string>;
}

/**
 * Learned catalog abilities are compared by ID *and* by printed name+source.
 * The ability picker clones catalog abilities with a fresh ID, so ID-only
 * detection would offer an already learned ability again.
 */
function ownedAbilities(character: Character): OwnedAbilities {
  const ids = new Set<string>();
  const keys = new Set<string>();
  for (const ability of Array.isArray(character.abilities)
    ? character.abilities
    : []) {
    if (!ability) continue;
    if (typeof ability.id === "string") ids.add(ability.id);
    if (ability.name || ability.source) {
      keys.add(abilityOwnershipKey(ability.name, ability.source));
    }
  }
  return { ids, keys };
}

function isAbilityOwned(
  entry: { id: string; name: string; source: string },
  owned: OwnedAbilities,
): boolean {
  return (
    owned.ids.has(entry.id) ||
    owned.keys.has(abilityOwnershipKey(entry.name, entry.source))
  );
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

// Resolve user-entered domain spellings to one canonical catalog key. Refuse
// normalized collisions so the result cannot depend on object/catalog order.
function canonicalDomain(value: string): string | undefined {
  const matches = Object.keys(DOMAIN_SKILL_SLOTS).filter(
    (domain) => normalizeToken(domain) === normalizeToken(value),
  );
  return matches.length === 1 ? matches[0] : undefined;
}

/**
 * Only a real class ability of this class and one of these exact levels may be
 * awarded automatically. Grants always pass the single target level; a choice
 * group may only widen the window when its own rule text says so.
 */
function resolveClassAbility(
  id: string,
  className: string,
  levels: number[],
): { entry?: CompendiumAbility; warning?: string } {
  const entry = COMPENDIUM_BY_ID.get(id);
  if (!entry) {
    return {
      warning: `Способность «${id}» из правил не найдена в справочнике; начислите её вручную по тексту раздела.`,
    };
  }
  const levelLabel =
    levels.length === 1
      ? `${levels[0]}-м уровне`
      : `${levels.join(", ")}-м уровнях`;
  if (
    entry.sourceKind !== "class" ||
    entry.className !== className ||
    !levels.includes(entry.level)
  ) {
    return {
      warning: `Способность «${entry.name}» из правил не совпадает со справочником класса на ${levelLabel}; начислите её вручную.`,
    };
  }

  return { entry };
}

/**
 * Which catalog levels a choice group may draw from. The sheet defaults to the
 * exact target level: an ability of another level is never a legal pick unless
 * the rule data explicitly lists source-backed levels for this group (for
 * example Elementalist 6 may take an unchosen level-5 ability for the same
 * essence cost). Future levels are always rejected.
 */
function abilityGroupLevels(
  group: LevelUpAbilityGroup,
  toLevel: number,
): number[] {
  const levels = new Set<number>([toLevel]);
  const declared: unknown = group.allowedLevels;
  if (Array.isArray(declared)) {
    for (const value of declared) {
      if (
        typeof value === "number" &&
        Number.isSafeInteger(value) &&
        value >= 1 &&
        value <= toLevel
      ) {
        levels.add(value);
      }
    }
  }
  return [...levels].sort((left, right) => left - right);
}

function cloneCharacterAbility(entry: Ability): Ability {
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

function cloneAdvancementRecord(
  record: LevelAdvancementRecord,
): LevelAdvancementRecord {
  const choices: Record<string, string[]> = {};
  if (isPlainObject(record.choices)) {
    for (const [key, ids] of Object.entries(record.choices)) {
      choices[key] = Array.isArray(ids)
        ? ids.filter((id): id is string => typeof id === "string")
        : [];
    }
  }
  // Unknown extra fields of an old record survive untouched.
  return {
    ...record,
    choices,
    notes: typeof record.notes === "string" ? record.notes : "",
  };
}

function subclassTokens(subclass: string): string[] {
  return subclass
    .split(",")
    .map(normalizeToken)
    .filter(Boolean);
}

/**
 * A scoped rule applies when the hero wields one of its subclasses. The sheet and
 * the rules use the same canonical builder names, and domains are stored comma
 * separated, so each token is compared exactly after trim/case/ё normalization.
 * An unknown subclass never silently matches a scoped rule.
 */
function appliesToSubclass(
  scoped: string[] | undefined,
  tokens: string[],
): boolean {
  if (!Array.isArray(scoped) || scoped.length === 0) return true;
  return scoped.some((name) => tokens.includes(normalizeToken(name)));
}

function baseCharacteristics(
  character: Character,
): Record<CharacteristicKey, number> {
  const result = {} as Record<CharacteristicKey, number>;
  for (const key of CHARACTERISTIC_KEYS) {
    const value = character.characteristics?.[key];
    result[key] = Number.isFinite(value) ? Number(value) : 0;
  }
  return result;
}

/** Absolute targets from the rules never lower a manually raised characteristic. */
function applyCharacteristicSet(
  current: Record<CharacteristicKey, number>,
  set: Partial<Record<CharacteristicKey, number>> | undefined,
): Record<CharacteristicKey, number> {
  const next = { ...current };
  if (!set) return next;
  for (const key of CHARACTERISTIC_KEYS) {
    const target = set[key];
    if (
      typeof target === "number" &&
      Number.isFinite(target) &&
      target > next[key]
    ) {
      next[key] = Math.trunc(target);
    }
  }
  return next;
}

function classPerkSlot(
  character: Character,
  level: number,
): PerkSlot | undefined {
  if (!(CLASS_PERK_LEVELS as readonly number[]).includes(level)) return undefined;
  return {
    key: `class-${level}`,
    source: "class",
    level,
    title: `Класс · ${level} уровень`,
    allowedTypes: classPerkTypes(character.className, level),
  };
}

function learnedSkillKeys(character: Character): Set<string> {
  return new Set(
    (Array.isArray(character.skills) ? character.skills : []).map(normalizeToken),
  );
}

/**
 * One place that resolves a character into everything a level-up needs.
 * It only reads the character; every caller gets fresh objects.
 */
function buildContext(character: Character): LevelUpContext {
  const warnings: string[] = [];
  const level = Number.isSafeInteger(character.level) ? character.level : 1;
  const fromLevel = level;
  const toLevel = Math.min(
    MAX_CHARACTER_LEVEL,
    Math.max(1, level + 1),
  );
  const xpRequired = levelUpXpRequirement(toLevel);
  const xp = Number.isFinite(character.xp) ? Number(character.xp) : 0;
  const xpMissing = Math.max(0, xpRequired - xp);
  const grown = baseCharacteristics(character);
  const classFeatures: LevelUpClassFeature[] = classFeatureGiftsAtLevel(
    character,
    toLevel,
  ).map((feature) => ({
    id: feature.id,
    name: feature.name,
    level: feature.level,
    summary: feature.summary,
  }));

  const unavailable = (
    reason: string,
    rule?: LevelUpRule,
  ): LevelUpContext => ({
    plan: {
      available: false,
      reason,
      fromLevel,
      toLevel,
      xpRequired,
      xpMissing,
      ...(rule ? { rule } : {}),
      choices: [],
      classFeatures,
      grantedAbilityIds: [],
      warnings,
    },
    choices: [],
    choiceById: new Map(),
    grown,
    granted: [],
  });

  if (!Number.isSafeInteger(character.level) || level < 1) {
    return unavailable(
      "Уровень героя вне допустимого диапазона 1–10; повышение уровня недоступно.",
    );
  }
  if (level >= MAX_CHARACTER_LEVEL) {
    return unavailable(
      `Герой уже достиг ${MAX_CHARACTER_LEVEL}-го уровня — выше расти нельзя.`,
    );
  }
  if (!classPreset(character.className)) {
    return unavailable(
      `Класс «${character.className || "без класса"}» не распознан — проверенных правил повышения нет. Измените уровень вручную.`,
    );
  }
  const rule = levelUpRule(character.className, toLevel);
  if (!rule) {
    return unavailable(
      `Для класса «${character.className}» нет проверенных правил повышения до ${toLevel}-го уровня. Измените уровень вручную.`,
    );
  }

  const subclass =
    typeof character.subclass === "string" ? character.subclass : "";
  const tokens = subclassTokens(subclass);
  const scopedChoiceGroups = rule.abilityChoices.filter(
    (group) => group.count > 0 && group.subclasses && group.subclasses.length > 0,
  );
  const scopedGrants = rule.grantedAbilities.filter(
    (grant) => grant.subclasses && grant.subclasses.length > 0,
  );
  if (
    tokens.length === 0 &&
    (scopedChoiceGroups.length > 0 || scopedGrants.length > 0)
  ) {
    if (scopedChoiceGroups.length > 0) {
      return unavailable(
        `Правила ${toLevel}-го уровня зависят от подкласса, а у героя он не указан. Укажите подкласс — обязательные выборы нельзя пропустить молча.`,
        rule,
      );
    }
    warnings.push(
      `Награды ${toLevel}-го уровня зависят от подкласса; пока подкласс не указан, они не начисляются.`,
    );
  }
  if (
    tokens.length > 0 &&
    scopedChoiceGroups.length > 0 &&
    !scopedChoiceGroups.some((group) =>
      appliesToSubclass(group.subclasses, tokens),
    )
  ) {
    return unavailable(
      `В правилах ${toLevel}-го уровня нет обязательных выборов для подкласса «${subclass}». Проверьте подкласс героя.`,
      rule,
    );
  }

  let grownChars = applyCharacteristicSet(
    grown,
    rule.characteristics?.set,
  );
  const increaseAll = rule.characteristics?.increaseAll;
  if (increaseAll) {
    if (
      !Number.isFinite(increaseAll.amount) ||
      increaseAll.amount <= 0 ||
      !Number.isFinite(increaseAll.cap)
    ) {
      warnings.push(
        `В правилах ${toLevel}-го уровня некорректное повышение всех характеристик; примените его вручную.`,
      );
    } else {
      grownChars = { ...grownChars };
      for (const key of CHARACTERISTIC_KEYS) {
        grownChars[key] = Math.max(
          grownChars[key],
          Math.min(increaseAll.cap, grownChars[key] + increaseAll.amount),
        );
      }
    }
  }

  const choices: ResolvedChoice[] = [];
  const choiceById = new Map<string, ResolvedChoice>();
  const addChoice = (
    choice: LevelUpChoice,
    required: boolean,
    abilityGroup?: LevelUpAbilityGroup,
  ): boolean => {
    if (choiceById.has(choice.id)) {
      warnings.push(
        `В правилах повторяется идентификатор выбора «${choice.id}»; лишний выбор пропущен.`,
      );
      return false;
    }
    if (choice.options.length === 0) return false;
    const resolved: ResolvedChoice = {
      choice,
      required,
      ...(abilityGroup ? { abilityGroup } : {}),
      optionOrder: new Map(choice.options.map((option, index) => [option.id, index])),
    };
    choices.push(resolved);
    choiceById.set(choice.id, resolved);
    return true;
  };

  const characteristicChoice = rule.characteristics?.choice;
  if (characteristicChoice) {
    const { amount, cap } = characteristicChoice;
    if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(cap)) {
      warnings.push(
        `В правилах ${toLevel}-го уровня некорректный выбор характеристики; примените его вручную.`,
      );
    } else {
      const options = CHARACTERISTICS.filter(
        (characteristic) => grownChars[characteristic.key] < cap,
      ).map((characteristic) => ({
        id: characteristic.key,
        label: characteristic.label,
        description: `+${amount} к характеристике, но не выше ${cap}`,
      }));
      if (options.length === 0) {
        warnings.push(
          `Все характеристики уже на максимуме ${cap} — выбор характеристики не требуется.`,
        );
      } else {
        addChoice(
          {
            id: "characteristic",
            kind: "characteristic",
            label: `Повышение характеристики (+${amount}, не выше ${cap})`,
            count: 1,
            options,
          },
          true,
        );
      }
    }
  }

  const owned = ownedAbilities(character);
  const granted: Ability[] = [];
  const grantedIds = new Set<string>();
  const grantedKeys = new Set<string>();
  for (const grant of rule.grantedAbilities) {
    if (!appliesToSubclass(grant.subclasses, tokens)) continue;
    for (const id of grant.abilityIds ?? []) {
      // A grant is always the target level itself, never a widened window.
      const resolved = resolveClassAbility(id, character.className, [toLevel]);
      if (!resolved.entry) {
        if (resolved.warning) warnings.push(resolved.warning);
        continue;
      }
      const entry = resolved.entry;
      const key = abilityOwnershipKey(entry.name, entry.source);
      if (isAbilityOwned(entry, owned)) {
        warnings.push(
          `Способность «${entry.name}» уже есть у героя — повторно не начисляется.`,
        );
        continue;
      }
      if (grantedIds.has(entry.id) || grantedKeys.has(key)) continue;
      grantedIds.add(entry.id);
      grantedKeys.add(key);
      granted.push(cloneCharacterAbility(entry));
    }
  }

  // At levels 4 and 7 a Conduit chooses which of their two domains grants its
  // feature. Resolve options from the book skeleton so the choice stays tied
  // to the actual domain pair and remains independent of automation.
  if (character.className === "Проводник" && ([4, 7] as number[]).includes(toLevel)) {
    const key = `conduit.domain.${toLevel}`;
    const rawDomains = selectedGroupValue(character, "conduit.domain");
    const domains = typeof rawDomains === "string"
      ? rawDomains.split(",").map((value) => value.trim()).filter(Boolean)
      : [];
    const normalizedDomains = [...new Set(domains.map(normalizeToken))];
    const options = GENERATED_CLASS_FEATURES
      .filter((feature) => feature.className === character.className &&
        feature.level === toLevel && feature.keyedBy === "domain" &&
        feature.parentId === `feature.conduit.level-${toLevel}.${toLevel}th-level-domain-feature` &&
        normalizedDomains.includes(normalizeToken(feature.keyValue ?? "")))
      .map((feature) => ({ id: feature.id, label: feature.name, description: feature.keyValue }));
    if (normalizedDomains.length !== 2 || options.length !== 2) {
      return unavailable(
        `Для получения особенности домена ${toLevel}-го уровня нужно указать два известных домена Проводника. Проверьте сохранённый выбор доменов; повышение заблокировано, награда не потеряна.`,
        rule,
      );
    }
    addChoice({
      id: key,
      kind: "ability",
      label: `Особенность домена ${toLevel}-го уровня`,
      count: 1,
      options,
    }, true);
  }
  // The feature gained at levels 4 and 7 determines which domain feature is
  // active at levels 5 and 8. Do not silently advance past a missing or stale
  // saved choice: the player can restore it in the class features panel.
  if (character.className === "Проводник" && ([5, 8] as number[]).includes(toLevel)) {
    const featureLevel = toLevel - 1;
    const key = `conduit.domain.${featureLevel}`;
    const savedValue = selectedGroupValue(character, key);
    const savedDomain = typeof savedValue === "string" ? canonicalDomain(savedValue) : undefined;
    const domainValue = selectedGroupValue(character, "conduit.domain");
    const domains = typeof domainValue === "string"
      ? domainValue.split(",").map((value) => canonicalDomain(value.trim()))
      : [];
    const validDomains = domains.length === 2 && domains.every(Boolean) &&
      new Set(domains).size === 2;
    const savedFeature = savedDomain && GENERATED_CLASS_FEATURES.find((feature) =>
      feature.className === character.className && feature.level === featureLevel &&
      feature.keyedBy === "domain" && normalizeToken(feature.keyValue ?? "") === normalizeToken(savedDomain),
    );
    if (!validDomains || !savedDomain || !domains.includes(savedDomain) || !savedFeature) {
      return unavailable(
        `Не сохранён корректный выбор особенности домена ${featureLevel}-го уровня. Восстановите пару доменов и выбор этой особенности в панели особенностей, затем повторите повышение; награда не потеряна.`,
        rule,
      );
    }
  }
  if (character.className === "Проводник" && ([2, 6, 9] as number[]).includes(toLevel)) {
    const groupId = `conduit.ability.domain.${toLevel}`;
    const domainValue = selectedGroupValue(character, "conduit.domain");
    const domains = typeof domainValue === "string"
      ? domainValue.split(",").map((value) => value.trim()).filter(Boolean)
      : [];
    const canonicalDomains = domains.map(canonicalDomain);
    const mappings = conduitAbilities.filter((entry) => entry.level === toLevel);
    if (domains.length === 2 && canonicalDomains.every(Boolean) && new Set(canonicalDomains).size === 2 && mappings.length > 0) {
      const existingAbilities = ownedAbilities(character);
      const options = canonicalDomains.flatMap((domain) => {
        const mapping = mappings.find(
          (entry) => normalizeToken(entry.domain) === normalizeToken(domain!),
        );
        const entry = mapping ? COMPENDIUM_BY_ID.get(mapping.abilityId) : undefined;
        if (
          !mapping || !entry || entry.className !== character.className ||
          entry.level !== toLevel || entry.sourceKind !== "class" ||
          isAbilityOwned(entry, existingAbilities)
        ) return [];
        return [{ id: entry.id, label: entry.name, description: domain! }];
      });
      if (options.length === 0) {
        warnings.push(
          `Обе доменные способности Проводника ${toLevel}-го уровня уже есть у героя; награда считается полученной, дубликаты не добавляются.`,
        );
      } else {
        addChoice(
          {
            id: groupId,
            kind: "ability",
            label: `Доменная способность ${toLevel}-го уровня`,
            count: 1,
            options,
          },
          true,
        );
      }
    } else {
      return unavailable(
        `Для получения доменной способности ${toLevel}-го уровня сначала выберите два известных домена Проводника. Проверьте сохранённый выбор доменов и повторите повышение; награда не потеряна.`,
        rule,
      );
    }
  }

  for (const group of rule.abilityChoices) {
    if (!appliesToSubclass(group.subclasses, tokens)) continue;
    const count =
      Number.isSafeInteger(group.count) && group.count > 0 ? group.count : 0;
    if (count === 0) continue;
    const options: LevelUpChoiceOption[] = [];
    const optionIds = new Set<string>();
    const optionKeys = new Set<string>();
    const groupLevels = abilityGroupLevels(group, toLevel);
    const levelSuffix =
      groupLevels.length > 1
        ? ` · ${groupLevels.join("/")} уровень`
        : undefined;
    let resolvedCount = 0;
    for (const id of group.abilityIds ?? []) {
      const resolved = resolveClassAbility(id, character.className, groupLevels);
      if (!resolved.entry) {
        if (resolved.warning) warnings.push(resolved.warning);
        continue;
      }
      resolvedCount += 1;
      const entry = resolved.entry;
      const key = abilityOwnershipKey(entry.name, entry.source);
      if (isAbilityOwned(entry, owned)) continue;
      // A granted ability is already awarded automatically; never offer it as a pick.
      if (grantedIds.has(entry.id) || grantedKeys.has(key)) continue;
      if (optionIds.has(entry.id) || optionKeys.has(key)) continue;
      optionIds.add(entry.id);
      optionKeys.add(key);
      options.push({
        id: entry.id,
        label: entry.name,
        ...(entry.kind === "heroic"
          ? {
              description: levelSuffix
                ? `Героическая способность${levelSuffix}`
                : "Героическая способность",
            }
          : {}),
      });
    }
    if (options.length === 0) {
      if (resolvedCount > 0) {
        warnings.push(
          `Все способности выбора «${group.label}» уже есть у героя — выбор не требуется.`,
        );
        continue;
      }
      return unavailable(
        `В правилах ${toLevel}-го уровня для выбора «${group.label}» нет ни одной проверенной способности. Начислите её вручную по тексту раздела.`,
        rule,
      );
    }
    if (options.length < count) {
      return unavailable(
        `В правилах ${toLevel}-го уровня для выбора «${group.label}» не хватает доступных способностей (нужно ${count}, доступно ${options.length}). Начислите способности вручную.`,
        rule,
      );
    }
    addChoice(
      {
        id: group.id,
        kind: "ability",
        label: group.label,
        count,
        options,
      },
      true,
      group,
    );
  }

  const perkSlot = classPerkSlot(character, toLevel);
  let existingPerk: SelectedPerk | undefined;
  if (perkSlot) {
    existingPerk = selectedPerkForSlot(character, perkSlot);
    const perkOptions = PERK_COMPENDIUM.filter(
      (perk) =>
        perkSlot.allowedTypes.includes(perk.type) &&
        !isPerkUsed(character, perk.id, perkSlot),
    ).map((perk) => ({
      id: perk.id,
      label: `${perk.name} · ${PERK_TYPE_META[perk.type].label}`,
      description: perk.summary || perk.description,
    }));
    // The current slot perk is the suggested default; an explicit replacement stays possible.
    if (existingPerk) {
      const existingIndex = perkOptions.findIndex(
        (option) => option.id === existingPerk!.perkId,
      );
      if (existingIndex > 0) {
        perkOptions.unshift(...perkOptions.splice(existingIndex, 1));
      }
    }
    if (perkOptions.length === 0) {
      if (!existingPerk) {
        return unavailable(
          `На ${toLevel}-м уровне положен классовый перк, но доступных вариантов не осталось. Выберите перк вручную или освободите существующий.`,
          rule,
        );
      }
      warnings.push(
        `Новых вариантов классового перка не осталось; сохранён уже выбранный перк ${toLevel}-го уровня.`,
      );
    } else {
      addChoice(
        {
          id: "perk",
          kind: "perk",
          label: `Классовый перк ${toLevel}-го уровня`,
          count: 1,
          options: perkOptions,
        },
        !existingPerk,
      );
    }
  }

  const skillCount =
    Number.isSafeInteger(rule.skillCount) && rule.skillCount > 0
      ? rule.skillCount
      : 0;
  if (skillCount > 0) {
    const learned = learnedSkillKeys(character);
    const skillOptions = ALL_CREATION_SKILLS.filter(
      (skill) => !learned.has(normalizeToken(skill)),
    ).map((skill) => ({ id: skill, label: skill }));
    if (skillOptions.length === 0) {
      warnings.push("Все навыки уже есть у героя — новый навык не требуется.");
    } else if (skillOptions.length < skillCount) {
      return unavailable(
        `Для ${toLevel}-го уровня положено навыков: ${skillCount}, а доступных новых навыков ${skillOptions.length}. Добавьте навык вручную.`,
        rule,
      );
    }
    if (skillOptions.length > 0) {
      addChoice(
        {
          id: "skill",
          kind: "skill",
          label:
            skillCount === 1 ? "Новый навык" : `Новые навыки (${skillCount})`,
          count: skillCount,
          options: skillOptions,
        },
        true,
      );
    }
  }

  // At 1 → 2 the Conduit also gains a skill from the domain that was not
  // selected for its level-one feature. Keep this separate from the level-two
  // domain ability choice below.
  if (character.className === "Проводник" && toLevel === 2) {
    const domainValue = selectedGroupValue(character, "conduit.domain");
    const domains = typeof domainValue === "string"
      ? domainValue.split(",").map((value) => value.trim()).filter(Boolean)
      : [];
    const chosenFirst = selectedGroupValue(character, "conduit.domain.1");
    const canonicalDomains = domains.map(canonicalDomain);
    const pair = [...new Set(canonicalDomains.filter(Boolean))];
    const first = typeof chosenFirst === "string" ? chosenFirst.trim() : "";
    const canonicalFirst = canonicalDomain(first);
    const complement = canonicalDomains.find((domain) => domain && domain !== canonicalFirst);
    if (domains.length !== 2 || pair.length !== 2 || !canonicalFirst || !canonicalDomains.includes(canonicalFirst) || !complement) {
      return unavailable(
        "Для повышения Проводника 1→2 сначала выберите в приложении оба домена и домен особенности 1-го уровня. Старый лист сохранён; награды второго домена не начислены и не потеряны.",
        rule,
      );
    }
    const slot = DOMAIN_SKILL_SLOTS[complement];
    const learned = learnedSkillKeys(character);
    const options = (slot?.options ?? [])
      .filter((skill) => !learned.has(normalizeToken(skill)))
      .map((skill) => ({ id: skill, label: skill }));
    if (!options.length) return unavailable(`В группе навыков домена «${complement}» нет доступных навыков; освободите навык и повторите повышение.`, rule);
    addChoice({ id: "conduit.domain.skill.2", kind: "skill", label: `Навык домена «${complement}»`, count: 1, options }, true);

    const grantedNames = DOMAIN_GRANTED_ABILITIES[complement] ?? [];
    for (const name of grantedNames) {
      const entry = ABILITY_COMPENDIUM.find((ability) => normalizeToken(ability.name) === normalizeToken(name) && ability.className === "Проводник" && ability.level === 1 && ability.sourceKind === "class");
      if (!entry || isAbilityOwned(entry, owned)) continue;
      const ownership = abilityOwnershipKey(entry.name, entry.source);
      if (!grantedIds.has(entry.id) && !grantedKeys.has(ownership)) {
        grantedIds.add(entry.id);
        grantedKeys.add(ownership);
        granted.push(cloneCharacterAbility(entry));
      }
    }
  }

  // Домен Цензора один, поэтому способность его особенности на 4-м и 7-м
  // уровнях не выбирается, а выдаётся: карточки 1-го уровня уже начислил билдер.
  if (character.className === "Цензор" && ([4, 7] as number[]).includes(toLevel)) {
    const domainValue = selectedGroupValue(character, "censor.domain");
    const domain = typeof domainValue === "string" ? domainValue.trim() : "";
    if (!domain) {
      return unavailable(
        `Для повышения Цензора до ${toLevel}-го уровня нужен выбранный домен: без него особенность домена и её способность не выдаются. Выберите домен в панели особенностей; награда не потеряна.`,
        rule,
      );
    }
    const bookDomain = canonicalDomain(domain);
    if (!bookDomain) {
      return unavailable(
        `Сохранённый домен «${domain}» не совпадает ни с одним доменом книги. Выберите домен заново в панели особенностей; награда не потеряна.`,
        rule,
      );
    }
    const mapping = censorDomainAbilities.find(
      (entry) =>
        entry.level === toLevel &&
        normalizeToken(entry.domain) === normalizeToken(bookDomain),
    );
    if (mapping) {
      const entry = COMPENDIUM_BY_ID.get(mapping.abilityId);
      if (!entry) {
        warnings.push(
          `Способность «${mapping.abilityId}» домена «${mapping.domain}» не найдена в справочнике; начислите её вручную.`,
        );
      } else if (!isAbilityOwned(entry, owned)) {
        const ownership = abilityOwnershipKey(entry.name, entry.source);
        if (!grantedIds.has(entry.id) && !grantedKeys.has(ownership)) {
          grantedIds.add(entry.id);
          grantedKeys.add(ownership);
          granted.push(cloneCharacterAbility(entry));
        }
      }
    }
  }

  if (rule.features.length > 0) {
    warnings.push(
      "Тексты новых особенностей доступны в правилах; автоматически применяются только характеристики, навыки, перки и способности.",
    );
  }

  return {
    plan: {
      available: true,
      fromLevel,
      toLevel,
      xpRequired,
      xpMissing,
      rule,
      choices: choices.map((resolved) => resolved.choice),
      classFeatures,
      grantedAbilityIds: granted.map((ability) => ability.id),
      warnings,
    },
    rule,
    choices,
    choiceById,
    perkSlot,
    existingPerk,
    grown: grownChars,
    granted,
  };
}

/** Read-only plan for the next level: requirements from the current to the next level. */
export function getLevelUpPlan(character: Character): LevelUpPlan {
  return buildContext(character).plan;
}

/**
 * Тексты правил уровня, которых нет в блоке «Что вы получите»: сверка по
 * нормализованному имени — одно и то же название не должно читаться в
 * диалоге дважды. Уровень у обоих списков один и тот же (`plan.toLevel`).
 */
export function uncoveredRuleFeatures(plan: LevelUpPlan): LevelUpFeature[] {
  if (!plan.rule) return [];
  const covered = new Set(
    plan.classFeatures.map((feature) => normalizeToken(feature.name)),
  );
  return plan.rule.features.filter(
    (feature) => !covered.has(normalizeToken(feature.name)),
  );
}

function requestIssues(
  character: Character,
  request: LevelUpRequest,
  plan: LevelUpPlan,
): string[] {
  const issues: string[] = [];
  if (!plan.available) {
    issues.push(plan.reason ?? "Повышение уровня недоступно.");
  }
  if (request.reviewedRules !== true) {
    issues.push("Отметьте, что правила нового уровня прочитаны.");
  }
  if (
    typeof request.characterId !== "string" ||
    request.characterId !== character.id
  ) {
    issues.push(
      "Запрос относится к другому герою или устарел: откройте повышение уровня заново.",
    );
  }
  if (request.className !== character.className) {
    issues.push(
      `Класс героя изменился (${character.className || "не указан"}); откройте повышение уровня заново.`,
    );
  }
  if (request.subclass !== (character.subclass ?? "")) {
    issues.push(
      `Подкласс героя изменился (${character.subclass || "не указан"}); откройте повышение уровня заново.`,
    );
  }
  if (request.fromLevel !== character.level) {
    issues.push(
      `Запрос построен для ${request.fromLevel}-го уровня, а герой уже на ${character.level}-м. Подтвердите повышение заново.`,
    );
  }
  if (request.mode !== "xp" && request.mode !== "milestone") {
    issues.push("Выберите способ повышения: опыт или решение ведущего.");
  }
  if (request.mode === "xp" && plan.xpMissing > 0) {
    issues.push(
      `Недостаточно опыта: нужно ${plan.xpRequired}, у героя ${Number.isFinite(character.xp) ? character.xp : 0}. Можно повысить по решению ведущего.`,
    );
  }
  if (request.notes !== undefined && typeof request.notes !== "string") {
    issues.push("Заметка к повышению уровня должна быть строкой.");
  } else if (typeof request.notes === "string" && request.notes.length > 2000) {
    issues.push("Заметка к повышению уровня длиннее 2000 символов.");
  }

  const manual = request.manualMaxima;
  if (manual !== undefined) {
    if (!isPlainObject(manual)) {
      issues.push(
        "Ручные максимумы должны быть объектом со значениями stamina и/или recoveries.",
      );
    } else {
      for (const [key, value] of Object.entries(manual)) {
        if (key !== "stamina" && key !== "recoveries") {
          issues.push(`Неизвестный ручной максимум «${key}».`);
          continue;
        }
        if (
          !Number.isSafeInteger(value) ||
          (value as number) < 0 ||
          (value as number) > 9999
        ) {
          issues.push(
            `Максимум «${key === "stamina" ? "выносливости" : "восстановлений"}» должен быть целым числом от 0 до 9999.`,
          );
        }
      }
      if (character.automation?.enabled) {
        issues.push(
          "Ручные максимумы применяются только при выключенной автоматизации: сейчас максимумы пересчитываются автоматически.",
        );
      }
    }
  }
  return issues;
}

function choiceIssues(
  context: LevelUpContext,
  request: LevelUpRequest,
): { issues: string[]; selections: Map<string, string[]> } {
  const issues: string[] = [];
  const selections = new Map<string, string[]>();

  if (!isPlainObject(request.choices)) {
    issues.push("Выборы повышения уровня должны быть объектом.");
  } else {
    const abilitySelection = new Map<string, string>();
    for (const [id, value] of Object.entries(request.choices)) {
      const resolved = context.choiceById.get(id);
      if (!resolved) {
        issues.push(`Неизвестный выбор «${id}» для повышения уровня.`);
        continue;
      }
      const label = resolved.choice.label;
      if (
        !Array.isArray(value) ||
        !value.every((optionId) => typeof optionId === "string")
      ) {
        issues.push(`Выбор «${label}» должен быть списком идентификаторов.`);
        continue;
      }
      if (new Set(value).size !== value.length) {
        issues.push(`В выборе «${label}» есть повторяющиеся значения.`);
        continue;
      }
      if (value.length === 0) continue;
      if (value.length !== resolved.choice.count) {
        issues.push(
          `В выборе «${label}» нужно ${resolved.choice.count}, а указано ${value.length}.`,
        );
        continue;
      }
      let valid = true;
      for (const optionId of value) {
        if (!resolved.choice.options.some((option) => option.id === optionId)) {
          issues.push(
            `«${optionId}» не входит в варианты выбора «${label}».`,
          );
          valid = false;
        }
      }
      if (!valid) continue;
      if (resolved.choice.kind === "ability") {
        for (const optionId of value) {
          const previous = abilitySelection.get(optionId);
          if (previous) {
            issues.push(
              `Способность «${optionId}» выбрана дважды («${previous}» и «${label}»).`,
            );
            valid = false;
          } else {
            abilitySelection.set(optionId, label);
          }
        }
        if (!valid) continue;
      }
      selections.set(id, [...value]);
    }
  }

  for (const resolved of context.choices) {
    if (!resolved.required) continue;
    if (selections.has(resolved.choice.id)) continue;
    if (
      resolved.choice.kind === "perk" &&
      context.existingPerk &&
      context.perkSlot?.level === context.existingPerk.level
    ) {
      continue;
    }
    issues.push(`Не выбран обязательный вариант «${resolved.choice.label}».`);
  }
  return { issues, selections };
}

/**
 * Validates the whole request and returns both the display character and the
 * raw patch-level character. `rawNext` intentionally keeps the saved maxima:
 * `App.update` recalculates once, and a pre-grown maximum would be accepted as
 * a manual override on that single pass.
 */
export function previewLevelUp(
  character: Character,
  request: LevelUpRequest,
): LevelUpPreview {
  const context = buildContext(character);
  const plan = context.plan;
  if (!isPlainObject(request)) {
    return {
      ok: false,
      issues: ["Некорректный запрос повышения уровня."],
      plan,
    };
  }
  const issues = requestIssues(character, request, plan);
  if (!plan.available || !context.rule) {
    if (issues.length === 0) issues.push("Повышение уровня недоступно.");
    return { ok: false, issues, plan };
  }
  const rule = context.rule;
  const choices = choiceIssues(context, request);
  issues.push(...choices.issues);
  if (issues.length > 0) return { ok: false, issues, plan };
  const selections = choices.selections;

  // Old abilities are kept as they are: unknown fields and IDs stay intact.
  const abilities = Array.isArray(character.abilities)
    ? [...character.abilities]
    : [];
  const addedIds = new Set(abilities.map((ability) => ability.id));
  const addedKeys = new Set(
    abilities
      .filter((ability) => ability.name || ability.source)
      .map((ability) => abilityOwnershipKey(ability.name, ability.source)),
  );
  const addAbility = (ability: Ability): void => {
    const key = abilityOwnershipKey(ability.name, ability.source);
    if (addedIds.has(ability.id) || addedKeys.has(key)) return;
    addedIds.add(ability.id);
    addedKeys.add(key);
    abilities.push(ability);
  };

  for (const resolved of context.choices) {
    if (resolved.choice.kind !== "ability") continue;
    for (const id of selections.get(resolved.choice.id) ?? []) {
      const entry = COMPENDIUM_BY_ID.get(id);
      if (entry) addAbility(cloneCharacterAbility(entry));
    }
  }
  for (const granted of context.granted) addAbility(granted);

  let perks = (Array.isArray(character.perks) ? character.perks : []).map(
    (perk) => ({ ...perk }),
  );
  const chosenPerkId = selections.get("perk")?.[0];
  const perkSlot = context.perkSlot;
  if (perkSlot && chosenPerkId) {
    const perk = perkById(chosenPerkId);
    if (perk) {
      perks = perks.filter(
        (existing) =>
          !(existing.source === "class" && existing.level === perkSlot.level),
      );
      perks.push({
        perkId: perk.id,
        name: perk.name,
        type: perk.type,
        source: "class",
        level: perkSlot.level,
      });
    }
  }

  const skills = [...(Array.isArray(character.skills) ? character.skills : [])];
  for (const resolved of context.choices) {
    if (resolved.choice.kind !== "skill") continue;
    for (const skill of selections.get(resolved.choice.id) ?? []) {
      if (!skills.includes(skill)) skills.push(skill);
    }
  }

  const characteristics = { ...context.grown };
  const characteristicSpec = rule.characteristics?.choice;
  for (const resolved of context.choices) {
    if (resolved.choice.kind !== "characteristic") continue;
    const chosen = selections.get(resolved.choice.id)?.[0];
    if (!characteristicSpec || !chosen) continue;
    const key = chosen as CharacteristicKey;
    if (!CHARACTERISTIC_KEYS.includes(key)) continue;
    characteristics[key] = Math.min(
      characteristicSpec.cap,
      characteristics[key] + characteristicSpec.amount,
    );
  }

  const recordChoices: Record<string, string[]> = {};
  for (const resolved of context.choices) {
    const selected = selections.get(resolved.choice.id);
    if (!selected || selected.length === 0) continue;
    recordChoices[resolved.choice.id] = [...selected].sort(
      (left, right) =>
        (resolved.optionOrder.get(left) ?? 0) -
        (resolved.optionOrder.get(right) ?? 0),
    );
  }

  const record: LevelAdvancementRecord = {
    fromLevel: plan.fromLevel,
    toLevel: plan.toLevel,
    className: character.className,
    subclass: typeof character.subclass === "string" ? character.subclass : "",
    mode: request.mode,
    articleId: rule.articleId,
    choices: recordChoices,
    notes: typeof request.notes === "string" ? request.notes.trim() : "",
    createdAt: new Date().toISOString(),
  };
  const oldAdvancements = Array.isArray(character.advancements)
    ? character.advancements.map(cloneAdvancementRecord)
    : [];

  let rawNext: Character = {
    ...character,
    level: plan.toLevel,
    characteristics,
    // New objects: nothing the caller mutates in `next` reaches the input sheet.
    stamina: { ...character.stamina },
    recoveries: { ...character.recoveries },
    heroicResource: { ...character.heroicResource },
    abilities,
    perks,
    skills,
    advancements: [...oldAdvancements, record],
  };

  if (character.className === "Проводник" && ([2, 6, 9] as number[]).includes(plan.toLevel)) {
    const choiceId = `conduit.ability.domain.${plan.toLevel}`;
    const chosenId = selections.get(choiceId)?.[0];
    const mapping = conduitAbilities.find(
      (entry) => entry.level === plan.toLevel && entry.abilityId === chosenId,
    );
    if (mapping) {
      const automation = rawNext.automation;
      rawNext = {
        ...rawNext,
        automation: {
          enabled: automation?.enabled ?? false,
          adjustments: automation?.adjustments ?? {},
          ancestryTraits: automation?.ancestryTraits ?? [],
          ...automation,
          classFeatureSelections: {
            ...(automation?.classFeatureSelections ?? {}),
            [choiceId]: mapping.domain,
          },
        },
      };
    }
  }

  if (character.className === "Проводник" && ([4, 7] as number[]).includes(plan.toLevel)) {
    const key = `conduit.domain.${plan.toLevel}`;
    const chosenId = selections.get(key)?.[0];
    const feature = GENERATED_CLASS_FEATURES.find((entry) =>
      entry.id === chosenId && entry.className === character.className &&
      entry.level === plan.toLevel && entry.keyedBy === "domain",
    );
    if (feature?.keyValue) {
      const automation = rawNext.automation;
      rawNext = {
        ...rawNext,
        automation: {
          enabled: automation?.enabled ?? false,
          adjustments: automation?.adjustments ?? {},
          ancestryTraits: automation?.ancestryTraits ?? [],
          ...automation,
          classFeatureSelections: {
            ...(automation?.classFeatureSelections ?? {}),
            [key]: feature.keyValue,
          },
        },
      };
    }
  }

  const manual = request.manualMaxima;
  if (!character.automation?.enabled && manual) {
    const staminaMax =
      typeof manual.stamina === "number" ? manual.stamina : character.stamina.max;
    const recoveriesMax =
      typeof manual.recoveries === "number"
        ? manual.recoveries
        : character.recoveries.max;
    rawNext = {
      ...rawNext,
      stamina: {
        ...character.stamina,
        max: staminaMax,
        current: Math.min(character.stamina.current, staminaMax),
      },
      recoveries: {
        ...character.recoveries,
        max: recoveriesMax,
        current: Math.min(character.recoveries.current, recoveriesMax),
      },
    };
  }

  const next = character.automation?.enabled
    ? recalculateCharacter(character, rawNext)
    : rawNext;
  return { ok: true, next, rawNext, plan };
}
