import type { CharacteristicKey, CompendiumAbility, OriginalFields } from "../types";

/**
 * Общие типы и нормализация проекций канонических правил для старых
 * потребителей листа и каталога.
 *
 * Модуль намеренно не импортирует сгенерированные данные: иначе импорт
 * способностей тянул бы в бандл статьи каталога и наоборот. Данные подключают
 * только два узких адаптера — `consumer-abilities.ts` и `consumer-library.ts`.
 */

export type CatalogKind = "treasure" | "title" | "project";

export interface CatalogEntry extends OriginalFields {
  id: string;
  kind: CatalogKind;
  name: string;
  category: string;
  echelon: number | null;
  markdown: string;
  summary: string;
  articleId: string;
  heading: string;
  keywords: string;
  prerequisite: string;
  projectGoal: string;
  projectCharacteristic: string;
}

export interface GlossaryEntry extends OriginalFields {
  id: string;
  name: string;
  english: string;
  markdown: string;
  letter: string;
}

/** Запись способности из проекции; поле предпочтения может отсутствовать. */
export type ConsumerAbilityRecord = Omit<
  CompendiumAbility,
  "preferredCharacteristic"
> & {
  preferredCharacteristic?: CharacteristicKey | "";
};

export interface ConsumerAbilityProjection {
  schemaVersion: number;
  abilities: ConsumerAbilityRecord[];
}

export interface ConsumerLibraryProjection {
  schemaVersion: number;
  catalog: CatalogEntry[];
  glossary: GlossaryEntry[];
}

export type PerkType =
  | "crafting"
  | "exploration"
  | "interpersonal"
  | "intrigue"
  | "lore"
  | "supernatural";

export interface ConsumerKitBonus {
  label: string;
  value: string;
}

/** Запись проекции комплектов; поля повторяют прежний каталог legacy-наборов. */
export interface ConsumerKit extends OriginalFields {
  id: string;
  name: string;
  summary: string;
  equipment: string;
  bonuses: ConsumerKitBonus[];
  signatureAbility: string;
}

export interface ConsumerKitProjection {
  schemaVersion: number;
  kits: ConsumerKit[];
}

export interface ConsumerPerk extends OriginalFields {
  id: string;
  name: string;
  type: PerkType;
  summary: string;
}

export interface ConsumerPerkProjection {
  schemaVersion: number;
  perks: ConsumerPerk[];
  careerPerkTypes: Record<string, PerkType>;
  classPerkRestrictions: Record<string, Record<number, PerkType[]>>;
}

export type AncestryFeatureKind = "signature" | "trait";

export interface ConsumerFeature extends OriginalFields {
  id: string;
  kind: "ancestry" | "class";
  /** Для происхождений: знаковая черта или купленная за очки. */
  ancestryKind?: AncestryFeatureKind;
  ancestryName?: string;
  className?: string;
  level: number;
  name: string;
  articleId: string;
  description: string;
}

export interface ConsumerFeatureProjection {
  schemaVersion: number;
  features: ConsumerFeature[];
}

export interface ConsumerLevelUpFeature extends OriginalFields {
  id: string;
  name: string;
  description: string;
}

export interface ConsumerLevelUpAbilityGroup {
  id: string;
  label: string;
  count: number;
  abilityIds: string[];
  subclasses?: string[];
  allowedLevels?: number[];
}

export interface ConsumerLevelUpCharacteristics {
  set?: Partial<Record<CharacteristicKey, number>>;
  increaseAll?: { amount: number; cap: number };
  choice?: { amount: number; cap: number };
}

export interface ConsumerLevelUpGrant {
  abilityIds: string[];
  subclasses?: string[];
}

/** Структура `LevelUpRule` из legacy-контракта `src/data/level-up-rules.ts`. */
export interface ConsumerLevelUpRule {
  className: string;
  level: number;
  articleId: string;
  title: string;
  features: ConsumerLevelUpFeature[];
  characteristics?: ConsumerLevelUpCharacteristics;
  skillCount: number;
  abilityChoices: ConsumerLevelUpAbilityGroup[];
  grantedAbilities: ConsumerLevelUpGrant[];
}

export interface ConsumerLevelUpProjection {
  schemaVersion: number;
  rules: ConsumerLevelUpRule[];
}

/** Происхождение в проекции конструктора (`builder.json`). */
export interface ConsumerBuilderTrait extends OriginalFields {
  id?: string;
  name: string;
  cost: number;
  text: string;
}

export interface ConsumerBuilderAncestry extends OriginalFields {
  id?: string;
  name: string;
  articleId: string;
  summary: string;
  signature: string;
  budget: number;
  traits: ConsumerBuilderTrait[];
}

export interface ConsumerBuilderCultureOption extends OriginalFields {
  id?: string;
  name: string;
  text: string;
  articleId: string;
}

export interface ConsumerBuilderCultures {
  environment: ConsumerBuilderCultureOption[];
  organization: ConsumerBuilderCultureOption[];
  upbringing: ConsumerBuilderCultureOption[];
}

export interface ConsumerBuilderCareer extends OriginalFields {
  id?: string;
  name: string;
  articleId: string;
  benefits: string;
  renown: number;
  wealth: number;
  incidents: string[];
}

export interface ConsumerBuilderFeatureOption {
  name: string;
  text: string;
}

export interface ConsumerBuilderFeatureChoice {
  name: string;
  text: string;
  options: ConsumerBuilderFeatureOption[];
}

export interface ConsumerBuilderSubclass extends OriginalFields {
  id?: string;
  name: string;
  text: string;
}

export interface ConsumerBuilderClass extends OriginalFields {
  id?: string;
  name: string;
  articleId: string;
  summary: string;
  basics: string;
  features: string;
  featureChoices: ConsumerBuilderFeatureChoice[];
  subclasses: ConsumerBuilderSubclass[];
}

export interface ConsumerBuilderComplication extends OriginalFields {
  id?: string;
  name: string;
  text: string;
  articleId: string;
}

/** Контракт `BUILDER_DATA` из `src/lib/character-builder.ts`. */
export interface ConsumerBuilderProjection {
  schemaVersion: number;
  ancestries: ConsumerBuilderAncestry[];
  cultures: ConsumerBuilderCultures;
  careers: ConsumerBuilderCareer[];
  classes: ConsumerBuilderClass[];
  complications: ConsumerBuilderComplication[];
}

/**
 * Достраивает предпочтительную характеристику так же, как прежний
 * `data/compendium.ts`: валидное значение сохраняется, иначе берётся первая
 * характеристика броска. Поведение расчётов не меняется.
 */
export function withPreferredCharacteristic(
  record: ConsumerAbilityRecord,
): CompendiumAbility {
  const preferred =
    record.preferredCharacteristic &&
    record.rollCharacteristics.includes(record.preferredCharacteristic)
      ? record.preferredCharacteristic
      : (record.rollCharacteristics[0] ?? "");
  return { ...record, preferredCharacteristic: preferred };
}
