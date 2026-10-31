import featuresJson from "../generated/consumers/features.json";
import { CANONICAL_BUILDER_DATA } from "./consumer-builder";
import type {
  AncestryFeatureKind,
  ConsumerFeature,
  ConsumerFeatureProjection,
} from "./consumer-data";

/**
 * Особенности происхождений и классов из канонических сущностей `feature`.
 * Единственный потребитель `generated/consumers/features.json` (плюс
 * `builder.json` только для стоимости купленных черт происхождений).
 *
 * Проекция особенностей не хранит стоимость черты: канонический Markdown
 * сохраняет её в прежнем префиксе `**Название (N очко):**`, но описание
 * очищается от разметки. Стоимость берём из проекции конструктора, где она
 * уже разобрана в `traits[].cost`; сопоставление идёт по происхождению и
 * названию черты.
 */
const features = (featuresJson as ConsumerFeatureProjection).features;
const builder = CANONICAL_BUILDER_DATA;

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

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase("ru").replaceAll("ё", "е");
}

function traitKey(ancestryName: string, name: string): string {
  return `${normalize(ancestryName)}|${normalize(name)}`;
}

const traitCosts = new Map<string, number>();
for (const ancestry of builder.ancestries) {
  for (const trait of ancestry.traits) {
    traitCosts.set(traitKey(ancestry.name, trait.name), trait.cost);
  }
}

export const CONSUMER_ANCESTRY_FEATURES: ConsumerAncestryFeature[] = features
  .filter((feature) => feature.kind === "ancestry")
  .map((feature) => {
    const ancestryKind = feature.ancestryKind ?? "trait";
    const ancestryName = feature.ancestryName ?? "";
    const cost =
      ancestryKind === "trait"
        ? traitCosts.get(traitKey(ancestryName, feature.name))
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
