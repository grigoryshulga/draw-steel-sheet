import featuresJson from "../generated/consumers/features.json";
import type {
  AncestryFeatureKind,
  ConsumerFeature,
  ConsumerFeatureProjection,
} from "./consumer-data";

/** Особенности и стоимость черт подготовлены генератором без зависимости от конструктора. */
const features = (featuresJson as ConsumerFeatureProjection).features;

export interface ConsumerAncestryFeature extends ConsumerFeature {
  kind: "ancestry";
  ancestryKind: AncestryFeatureKind;
  ancestryName: string;
  /** Стоимость в очках происхождения; у знаковых черт её нет. */
  cost?: number;
}

export interface ConsumerClassFeature extends ConsumerFeature {
  kind: "class";
  className: string;
}

export const CONSUMER_ANCESTRY_FEATURES: ConsumerAncestryFeature[] = features
  .filter((feature) => feature.kind === "ancestry")
  .map((feature) => {
    const ancestryKind = feature.ancestryKind ?? "trait";
    const ancestryName = feature.ancestryName ?? "";
    const cost =
      ancestryKind === "trait"
        ? feature.cost
        : undefined;
    return {
      ...feature,
      kind: "ancestry",
      ancestryKind,
      ancestryName,
      ...(cost !== undefined ? { cost } : {}),
    };
  });

export const CONSUMER_CLASS_FEATURES: ConsumerClassFeature[] = features
  .filter((feature) => feature.kind === "class")
  .map((feature) => ({
    ...feature,
    kind: "class",
    className: feature.className ?? "",
  }));
