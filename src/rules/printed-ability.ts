import type { CharacteristicKey } from "../types";
import type { DamageTypeKey } from "../lib/damageType";

export type DistanceMode = "melee" | "ranged" | "within";
export type PrintedDistance = (string | { mode: DistanceMode; value: number })[];

export interface PrintedTier {
  effect: string;
  richEffect?: true;
  damage?: { value: string; type?: DamageTypeKey };
}

export interface PrintedRoll {
  title: string;
  characteristic?: CharacteristicKey;
  tiers: PrintedTier[];
}

export type PrintedBlock = { text: string } | { roll: PrintedRoll };

/** Build output from a book edition. Character documents contain their own selections and modifiers. */
export interface PrintedAbility {
  flavor?: string;
  facts?: { action: string; distance: PrintedDistance; target: string; keywords: string[] };
  beforeRoll?: string;
  roll?: PrintedRoll;
  trigger?: string;
  effect?: string;
  blocks: PrintedBlock[];
}
