export type FeatureStat =
  | "stamina"
  | "recoveries"
  | "speed"
  | "stability"
  | "disengage"
  | "save";

export type FeatureCondition = {
  equipment?: "lightArmor" | "lightWeapon";
  noKit?: boolean;
};

export type FeatureEffect =
  | {
      kind: "stat";
      stat: FeatureStat;
      value: number;
      perEchelon?: number;
      stackingGroup?: string;
      when?: FeatureCondition;
    }
  | {
      kind: "damage" | "distance";
      value: number;
      keywords: string[];
      rolledOnly?: boolean;
      when?: FeatureCondition;
    };
