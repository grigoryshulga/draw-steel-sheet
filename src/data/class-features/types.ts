import type { ActionType, CharacteristicKey } from "../../types";

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
  characteristic?: CharacteristicKey;
  mode?: "melee" | "ranged";
  actionType?: ActionType[];
}

/** Когда эффект действует на героя. */
export interface FeatureCondition {
  equipment?: { lightArmor?: boolean; lightWeapon?: boolean };
  noKit?: boolean;
  minLevel?: number;
  /** Выбранные значения ключевых групп (например, аспект «Берсерк»). */
  keyValue?: string[];
  resourceAtLeast?: { name: string; value: number };
  formActive?: string;
}

export type FeatureEffect =
  | {
      kind: "field";
      field: FeatureField;
      value: FeatureAmount;
      perEchelon?: number;
      cap?: number;
      filter?: FeatureFilter;
      when?: FeatureCondition;
      stackingGroup?: string;
      /** `false` разрешает эффект урона способности без броска силы с числовым уроном. */
      rolledOnly?: boolean;
    }
  | { kind: "characteristic"; key: CharacteristicKey; value: number }
  | { kind: "damageImmunity"; types: string[]; value: FeatureAmount; when?: FeatureCondition }
  | { kind: "conditionImmunity"; conditions: string[] }
  | { kind: "proficiency"; armor?: string[]; weapons?: string[]; treasures?: boolean };

export type TriggerEvent =
  | "start-of-turn"
  | "end-of-turn"
  | "take-damage"
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
  effect?: FeatureEffect[];
}

export interface FeatureChoice {
  group: string;
  options: { id: string; label: string }[];
}

export interface ResourceGain {
  tag: string;
  event: TriggerEvent;
  amount: string;
  frequency: TriggerFrequency;
  replaces?: string[];
}

export interface HeroicResourceSpec {
  name: string;
  canBeNegative?: boolean;
  gains: ResourceGain[];
  thresholds?: { level: number; note: string }[];
  epic?: { name: string; gains: ResourceGain[] };
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
  effects?: FeatureEffect[];
  trigger?: FeatureTrigger;
  choice?: FeatureChoice;
  resource?: HeroicResourceSpec;
  notes?: string;
}
