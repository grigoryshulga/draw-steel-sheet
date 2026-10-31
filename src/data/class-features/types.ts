import type { CharacteristicKey, OriginalFields } from "../../types";

/** Числовые поля листа, которые складываются из эффектов фич. */
export type FeatureField =
  | "stamina"
  | "recoveries"
  | "recoveryValue"
  | "speed"
  | "stability"
  | "save"
  | "disengage"
  | "rolledDamage"
  | "freeStrikeDamage"
  | "distance"
  | "push"
  | "pull"
  | "slide"
  | "potency";

/** Сохранённые числовые характеристики листа; `save` считается на лету. */
export type FeatureStat =
  | "stamina"
  | "recoveries"
  | "speed"
  | "stability"
  | "disengage"
  | "save";

/** Значение эффекта: число, показатель характеристики или уровень героя. */
export type FeatureAmount =
  | number
  | { characteristic: CharacteristicKey }
  | { level: true };

/** К каким способностям применяется эффект; все заданные условия должны совпасть. */
export interface FeatureFilter {
  keywords?: string[];
  mode?: "melee" | "ranged";
}

/** Когда эффект действует на героя. */
export interface FeatureCondition {
  /** Флаг означает требование снаряжения: `false` не выражает «без брони». */
  equipment?: { lightArmor?: true; lightWeapon?: true };
  noKit?: boolean;
  minLevel?: number;
  /** Выбранные значения ключевых групп (например, аспект «Берсерк»). */
  keyValue?: string[];
  /** Все перечисленные значения должны быть выбраны (например, амплуа и её особенность). */
  keyValueAll?: string[];
  resourceAtLeast?: { name: string; value: number };
  formActive?: string;
}

export type FeatureEffect =
  | {
      kind: "field";
      field: FeatureField;
      value: FeatureAmount;
      perEchelon?: number;
      /**
       * Прибавка за КАЖДЫЙ уровень героя: итог = value + perLevel * level.
       * Для «+3 за уровень» (уровень 2 → 6) пиши value: 0, perLevel: 3;
       * смещения вида «выше 2-го» отдельного поля не имеют.
       */
      perLevel?: number;
      cap?: number;
      filter?: FeatureFilter;
      when?: FeatureCondition;
      stackingGroup?: string;
      /** `false` разрешает эффект урона способности без броска силы с числовым уроном. */
      rolledOnly?: boolean;
    }
  | { kind: "characteristic"; key: CharacteristicKey; value: number }
  | {
      kind: "damageImmunity";
      types: string[];
      value: FeatureAmount;
      /** Множитель к значению: «иммунитет равен двойному показателю Мощи» — 2. */
      multiplier?: number;
      /** Прибавка за каждый уровень героя: «иммунитет 5 + уровень». */
      perLevel?: number;
      when?: FeatureCondition;
    }
  | { kind: "conditionImmunity"; conditions: string[] }
  | { kind: "proficiency"; armor?: string[]; weapons?: string[]; treasures?: boolean };

export type TriggerEvent =
  | "start-of-turn"
  | "end-of-turn"
  | "take-damage"
  | "lose-stamina"
  | "forced-movement"
  | "combat-start"
  | "deal-damage"
  | "hit"
  | "crit"
  | "miss"
  | "ally-damaged"
  | "adjacent-enemy-damages-you"
  | "first-per-round"
  | "winded"
  | "dying"
  | "spend-recovery"
  | "enemy-enters"
  | "save-failed"
  | "save-succeeded"
  | "respite"
  | "victory"
  | "use-ability"
  | "form-changed"
  | "passive";

export type TriggerFrequency = "turn" | "round" | "encounter" | "respite" | "always";

export interface FeatureTrigger {
  event: TriggerEvent;
  frequency: TriggerFrequency;
  label: string;
  detail: string;
  /** Условия срабатывания: у пороговых строк таблиц — аспект и порог ресурса. */
  when?: FeatureCondition;
  effect?: FeatureEffect[];
}

export interface FeatureChoice {
  group: string;
  /** Подпись группы для листа, если группа не видовая (`talent.augmentation`). */
  label?: string;
  /**
   * Показывать выбор в панели листа, даже если группа не видовая и не входит
   * в старый реестр (например, «Призвание» Трубадура). Значения — id опций.
   */
  sheet?: boolean;
  options: { id: string; label: string }[];
}

export interface ResourceGain {
  tag: string;
  event: TriggerEvent;
  amount: string;
  /** Значение, выбираемое по уровню героя: берётся запись с наибольшим level, не превышающим уровень героя. */
  amountByLevel?: { level: number; amount: string }[];
  /** Минимальный уровень героя, на котором прибавка отображается. */
  minLevel?: number;
  frequency: TriggerFrequency;
  replaces?: string[];
  /**
   * Подпись для листа, если события мало: «первый раз за раунд, когда
   * осуждённый наносит тебе урон» одним `TriggerEvent` не выразить.
   * Без подписи берётся словарная подпись события.
   */
  label?: string;
}

export interface HeroicResourceSpec {
  name: string;
  canBeNegative?: boolean;
  gains: ResourceGain[];
  thresholds?: { level: number; note: string }[];
  /**
   * Эпический пул класса: показывается и начисляется с уровня `level`
   * (по умолчанию — 10-й, как в книге у всех классов).
   */
  epic?: { name: string; gains: ResourceGain[]; level?: number };
}

export type FeatureKind =
  | "bonus"
  | "characteristic"
  | "proficiency"
  | "immunity"
  | "resource"
  | "resourceGain"
  | "trigger"
  | "choice"
  | "grant"
  | "situational"
  | "text";

export interface FeatureMechanics {
  kinds: FeatureKind[];
  /**
   * Условия показа самой особенности: аспект, минимальный уровень, форма.
   * Список активных фич смотрит только на статичные условия из этого поля;
   * динамические (`resourceAtLeast`) фичу из списка не убирают — порог
   * показывается на листе как требование к ресурсу.
   */
  when?: FeatureCondition;
  effects?: FeatureEffect[];
  trigger?: FeatureTrigger;
  choice?: FeatureChoice;
  resource?: HeroicResourceSpec;
  notes?: string;
}

/** Группа выбора подкласса, по которой вложенная особенность достаётся одному варианту. */
export type FeatureKeyGroup =
  | "aspect"
  | "order"
  | "domain"
  | "tradition"
  | "doctrine"
  | "college"
  | "troupe"
  | "specialization";

/**
 * Запись скелета из `class-features.generated.json`: разобранный текст книги без механики.
 * Механика живёт отдельно, ключом по `id`.
 */
export interface GeneratedClassFeature extends OriginalFields {
  id: string;
  className: string;
  level: number;
  name: string;
  /** Родительская особенность, если запись разобрана из заголовка или строки таблицы. */
  parentId?: string;
  keyedBy?: FeatureKeyGroup;
  /** Значение группы выбора (`"Берсерк"`) или порога (`"2"`) для вложенной записи. */
  keyValue?: string;
  articleId: string;
  /** id записи `level-up.generated.json`; у особенностей 1-го уровня её нет. */
  featureId?: string;
  description: string;
}
