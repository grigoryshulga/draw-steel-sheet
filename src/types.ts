export const CHARACTERISTIC_KEYS = [
  "might",
  "agility",
  "reason",
  "intuition",
  "presence",
] as const;

export type CharacteristicKey = (typeof CHARACTERISTIC_KEYS)[number];

export type ActionType =
  | "main"
  | "maneuver"
  | "move"
  | "trigger"
  | "free-trigger"
  | "free-maneuver"
  | "none";

export type AbilityKind = "free-strike" | "signature" | "heroic" | "other";

export type ItemCategory = "gear" | "consumable" | "treasure" | "trinket" | "title";

export type NoteSectionKey = "story" | "contacts" | "debts" | "secrets" | "misc";

export type NoteSections = Record<NoteSectionKey, string>;

export type PerkType =
  | "crafting"
  | "exploration"
  | "interpersonal"
  | "intrigue"
  | "lore"
  | "supernatural";

export interface Perk {
  id: string;
  name: string;
  type: PerkType;
  summary: string;
  description: string;
  source: string;
}

export interface SelectedPerk {
  perkId: string;
  name: string;
  type: PerkType;
  source: "career" | "class" | "custom";
  level: number;
  /** Для собственных перков; у каталожных описание берётся из справочника. */
  summary?: string;
  description?: string;
}

export interface AbilityTier {
  /** Формула урона: "3 + M", "5 + Л или М", "1d6 + 2". Пусто — урона нет. */
  damage: string;
  /** Эффект тира. */
  effect: string;
}

export interface Ability {
  id: string;
  name: string;
  flavor: string;
  actionType: ActionType;
  kind: AbilityKind;
  keywords: string[];
  weaponMode?: 'melee' | 'ranged';
  distance: string;
  target: string;
  /** Характеристики, доступные для броска силы. Пусто — способность без броска. */
  rollCharacteristics: CharacteristicKey[];
  /** Предпочтительная характеристика для броска и расчёта тиров. */
  preferredCharacteristic: CharacteristicKey | "";
  /** Числовой бонус к броску силы, помимо характеристики. */
  rollBonus: number;
  /** Стоимость героического ресурса. 0 — бесплатная. */
  resourceCost: number;
  trigger: string;
  tiers: [AbilityTier, AbilityTier, AbilityTier];
  effect: string;
  source: string;
  notes: string;
}

export type ConditionEnd = "save" | "end-turn" | "next-turn" | "encounter" | "until-removed";

export interface ConditionState {
  active: boolean;
  ends: ConditionEnd;
}

export interface InventoryItem {
  catalogId?: string;
  id: string;
  name: string;
  category: ItemCategory;
  qty: number;
  notes: string;
  equipped: boolean;
}

export interface ProjectRow {
  catalogId?: string;
  id: string;
  name: string;
  assigned: string;
  characteristic: string;
  goal: string;
  points: string;
}

export interface Character {
  schemaVersion: 1;
  id: string;
  name: string;
  ancestry: string;
  className: string;
  career: string;
  subclass: string;
  level: number;
  xp: number;
  epic: number;
  victories: number;
  wealth: string;
  renown: string;

  characteristics: Record<CharacteristicKey, number>;

  stamina: { current: number; max: number; temp: number };
  recoveries: { current: number; max: number };
  heroicResource: { name: string; current: number; max: number };
  surges: number;
  heroTokens: number;

  size: string;
  speed: string;
  stability: string;
  disengage: string;

  kit: string;
  secondaryKit?: string;
  weapon: string;
  armor: string;
  equipmentEffects: string;

  conditions: Record<string, ConditionState>;
  abilities: Ability[];
  perks: SelectedPerk[];

  skills: string[];
  languages: string[];
  culture: {
    environment: string;
    organization: string;
    upbringing: string;
  };
  careerInfo: {
    benefits: string;
    details: string;
    incitingIncident: string;
  };
  ancestryTraits: string;
  classFeatures: string;
  notes: NoteSections;

  inventory: InventoryItem[];
  projects: ProjectRow[];

  createdAt: string;
  updatedAt: string;
  /** Opt-in keeps existing manually calculated sheets unchanged. */
  automation?: {
    enabled: boolean;
    adjustments: Partial<Record<"stamina" | "recoveries" | "speed" | "stability" | "disengage", number>>;
    ancestryTraits: string[];
    meleeDamageKit?: string;
    rangedDamageKit?: string;
  };
}

export interface CompendiumAbility extends Ability {
  className: string;
  level: number;
  sourceKind: "class" | "kit" | "basic";
}

export interface CharacterSummary {
  id: string;
  name: string;
  className: string;
  ancestry: string;
  level: number;
  updatedAt: string;
}

export interface AppTheme {
  name: string;
  mode: "dark" | "light";
  colors: Record<string, string>;
}

export interface DerivedStats {
  recoveryValue: number;
  winded: number;
  highestCharacteristic: number;
  potency: { weak: number; average: number; strong: number };
  tierThresholds: Record<CharacteristicKey, { t2: number; t3: number }>;
}
