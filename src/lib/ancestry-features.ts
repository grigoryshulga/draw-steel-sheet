import { ancestryMechanicsFor } from "../data/ancestry-features/mechanics";
import { LEGACY_ANCESTRY_FEATURE_IDS } from "../data/originals";
import {
  ancestryFeatureById,
  ancestryFeatureRecords,
  ancestryTraitFeature,
} from "../data/ancestry-features/skeleton";
import type {
  AncestryAbilityChoice,
  AncestryFeatureMechanics,
  GeneratedAncestryFeature,
} from "../data/ancestry-features/types";
import type { Ability, Character } from "../types";
import { normalizeFeatureText } from "./utils";

/** Активная черта происхождения: знаковая или выбранная за очки. */
export interface ActiveAncestryFeature {
  id: string;
  name: string;
  ancestryName: string;
  kind: GeneratedAncestryFeature["kind"];
  cost?: number;
  description: string;
  mechanics: AncestryFeatureMechanics | undefined;
}

/** Способность, выданная происхождением, вместе с её источником. */
export interface AncestryAbilityEntry {
  ability: Ability;
  ancestryName: string;
  featureId: string;
  featureName: string;
  featureKind: GeneratedAncestryFeature["kind"];
  /** Для выбранной способности — ключ выбора; иначе `undefined`. */
  choiceGroup?: string;
}

/** Выбор способности в панели листа. */
export interface AncestryFeatureChoiceState {
  group: string;
  label: string;
  options: { id: string; label: string }[];
  selected: string;
  warning?: string;
}

function normalize(value: string | undefined): string {
  return normalizeFeatureText(value ?? "");
}

/**
 * Канонические ID выбранных черт. Знаковые черты входят всегда, потому что
 * они выдаются вместе с происхождением. Купленные черты берутся из
 * `ancestryTraitIds`, а для старых листов — из названий в `ancestryTraits`:
 * до появления способностей билдер писал в ID только числовые черты.
 */
export function selectedAncestryFeatureIds(
  character: Character,
): Set<string> {
  const ancestryName = character.ancestry ?? "";
  const ids = new Set<string>();
  for (const feature of ancestryFeatureRecords(ancestryName)) {
    if (feature.kind === "signature") ids.add(feature.id);
  }

  const automation = character.automation;
  if (!automation) {
    // Старый ручной лист хранит выбранные черты только текстом в формате
    // «Название (стоимость): описание». Читаем точный префикс, чтобы
    // способность появилась и без структурной автоматизации.
    const legacyText = character.ancestryTraits ?? "";
    for (const feature of ancestryFeatureRecords(ancestryName)) {
      if (
        feature.kind === "trait" &&
        feature.cost !== undefined &&
        legacyText.includes(`${feature.name} (${feature.cost}):`)
      ) {
        ids.add(feature.id);
      }
    }
    return ids;
  }

  const canonical = automation.ancestryTraitIds;
  if (Array.isArray(canonical)) {
    for (const id of canonical) {
      const feature = ancestryFeatureById(id);
      if (
        feature?.kind === "trait" &&
        normalize(feature.ancestryName) === normalize(ancestryName)
      ) {
        ids.add(feature.id);
      }
    }
  }

  // Названия дополняют канонические ID, а не заменяют их: старый лист мог
  // сохранить ID только для черт из числового реестра.
  for (const name of automation.ancestryTraits ?? []) {
    const feature = ancestryTraitFeature(ancestryName, name);
    if (feature) ids.add(feature.id);
  }

  return ids;
}

/** Активные черты в порядке книги: знаковые, затем купленные. */
export function activeAncestryFeatures(
  character: Character,
): ActiveAncestryFeature[] {
  const ancestryName = character.ancestry ?? "";
  const selected = selectedAncestryFeatureIds(character);
  return ancestryFeatureRecords(ancestryName)
    .filter((feature) => selected.has(feature.id))
    .map((feature) => ({
      id: feature.id,
      name: feature.name,
      ancestryName: feature.ancestryName,
      kind: feature.kind,
      ...(feature.cost !== undefined ? { cost: feature.cost } : {}),
      description: feature.description,
      mechanics: ancestryMechanicsFor(feature.id),
    }));
}

const LEGACY_ANCESTRY_GROUP_KEYS = new Map(
  Object.entries(LEGACY_ANCESTRY_FEATURE_IDS).map(([legacyId, canonicalId]) => [
    canonicalId,
    legacyId,
  ]),
);

function savedChoiceValue(character: Character, group: string): string | undefined {
  const selections = character.automation?.ancestryFeatureSelections;
  if (!selections) return undefined;
  const direct = selections[group];
  if (typeof direct === "string") return direct;
  const legacyGroup = LEGACY_ANCESTRY_GROUP_KEYS.get(group);
  const legacy = legacyGroup ? selections[legacyGroup] : undefined;
  if (typeof legacy === "string" && legacyGroup && legacy.startsWith(legacyGroup)) {
    return group + legacy.slice(legacyGroup.length);
  }
  return legacy;
}

function choiceSelection(
  choice: AncestryAbilityChoice,
  character: Character,
): { optionId: string; warning?: string } {
  const raw = savedChoiceValue(character, choice.group);
  if (typeof raw !== "string" || raw.trim() === "") {
    return { optionId: "" };
  }
  const wanted = normalize(raw);
  const option = choice.options.find(
    (candidate) =>
      candidate.id === raw || normalize(candidate.label) === wanted,
  );
  if (option) return { optionId: option.id };
  return {
    optionId: "",
    warning: `Сохранено: ${raw}. Этого варианта нет в списке; выберите способность заново.`,
  };
}

/**
 * Способности происхождения для листа. От `automation.enabled` не зависят:
 * авторасчёт отвечает за числа, а выданная карточка — часть правил героя.
 * Знаковые способности приходят всегда; выбранная из списка — только после
 * выбора, чтобы лист не показывал три взаимоисключающие карточки сразу.
 */
export function ancestryAbilityEntries(
  character: Character,
): AncestryAbilityEntry[] {
  const entries: AncestryAbilityEntry[] = [];
  const seen = new Set<string>();

  const add = (
    feature: ActiveAncestryFeature,
    ability: Ability,
    choiceGroup?: string,
  ) => {
    if (seen.has(ability.id)) return;
    seen.add(ability.id);
    entries.push({
      ability,
      ancestryName: feature.ancestryName,
      featureId: feature.id,
      featureName: feature.name,
      featureKind: feature.kind,
      ...(choiceGroup ? { choiceGroup } : {}),
    });
  };

  for (const feature of activeAncestryFeatures(character)) {
    const mechanics = feature.mechanics;
    if (!mechanics) continue;
    for (const ability of mechanics.abilities ?? []) {
      add(feature, ability);
    }
    if (mechanics.choice) {
      const selection = choiceSelection(mechanics.choice, character);
      const option = mechanics.choice.options.find(
        (candidate) => candidate.id === selection.optionId,
      );
      if (option) add(feature, option.ability, mechanics.choice.group);
    }
  }

  return entries;
}

/** Выборы способностей, которые лист должен показать для выбранных черт. */
export function ancestryFeatureChoicesForSheet(
  character: Character,
): AncestryFeatureChoiceState[] {
  const choices: AncestryFeatureChoiceState[] = [];
  for (const feature of activeAncestryFeatures(character)) {
    const choice = feature.mechanics?.choice;
    if (!choice) continue;
    const selection = choiceSelection(choice, character);
    choices.push({
      group: choice.group,
      label: choice.label,
      options: choice.options.map((option) => ({
        id: option.id,
        label: option.label,
      })),
      selected: selection.optionId,
      ...(selection.warning ? { warning: selection.warning } : {}),
    });
  }
  return choices;
}

/** Сохраняет выбор способности происхождения; пустое значение удаляет его. */
export function withAncestryFeatureSelection(
  character: Character,
  group: string,
  value: string,
): Character {
  const automation = character.automation ?? {
    enabled: false,
    adjustments: {},
    ancestryTraits: [],
  };
  const selections = { ...automation.ancestryFeatureSelections };
  if (value) selections[group] = value;
  else delete selections[group];
  return {
    ...character,
    automation: { ...automation, ancestryFeatureSelections: selections },
  };
}

export interface AncestryFeatureChoiceDefinition {
  featureId: string;
  featureName: string;
  choice: AncestryAbilityChoice;
}

/** Способности одной купленной черты; пусто, если черта не даёт карточек. */
export function ancestryTraitAbilities(
  ancestryName: string,
  featureName: string,
): Ability[] {
  const feature = ancestryTraitFeature(ancestryName, featureName);
  if (!feature) return [];
  return ancestryMechanicsFor(feature.id)?.abilities ?? [];
}

/** Выбор способности одной купленной черты; `undefined`, если выбора нет. */
export function ancestryTraitChoice(
  ancestryName: string,
  featureName: string,
): AncestryAbilityChoice | undefined {
  const feature = ancestryTraitFeature(ancestryName, featureName);
  if (!feature) return undefined;
  return ancestryMechanicsFor(feature.id)?.choice;
}

/**
 * Выборы способностей для черт, отмеченных в конструкторе. В отличие от листа
 * здесь нет сохранённых значений: `draft.ancestryChoices` держит их отдельно.
 */
export function ancestryFeatureChoiceDefinitions(
  ancestryName: string,
  traitNames: readonly string[],
): AncestryFeatureChoiceDefinition[] {
  const definitions: AncestryFeatureChoiceDefinition[] = [];
  for (const name of traitNames) {
    const choice = ancestryTraitChoice(ancestryName, name);
    if (!choice) continue;
    const feature = ancestryTraitFeature(ancestryName, name);
    if (!feature) continue;
    definitions.push({
      featureId: feature.id,
      featureName: feature.name,
      choice,
    });
  }
  return definitions;
}
