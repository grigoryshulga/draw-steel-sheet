import { kitByName, type Kit } from "../data/kits";
import { canonicalAbilityId } from "../data/originals";
import type { Ability, Character, StormwightForm, StormwightFormRuntime } from "../types";
import { featureConditionMet } from "./feature-conditions";
import { currentRuntime } from "./runtime";

export const STORMWIGHT_HYBRID_STAMINA = "stormwight.hybrid-stamina";
export const ASPECT_OF_THE_WILD = "feature.ability.fury.level-1.beast-shape";

export interface StormwightFormState {
  kit: Kit;
  form: StormwightForm;
  trueSize: string;
  size: string;
  hybridSize: "1S" | "1M";
  chooseHybridSize: boolean;
  speedBonus: number;
  meleeDistanceBonus: number;
  flight: boolean;
  climb: boolean;
  ignoreDifficultTerrain: boolean;
  limitedAbilities: boolean;
  hybridStamina: boolean;
  description: string;
}

export function activeStormwightKit(character: Character): Kit | undefined {
  if (character.className !== "Неистовый" || !featureConditionMet(character, { keyValue: ["Буревестник"] })) return undefined;
  const kit = kitByName(character.kit);
  return kit?.familyId === "kit.stormwight" ? kit : undefined;
}

/** Статистика формы не зависит от количества свирепости; постоянные бонусы комплекта остаются. */
export function stormwightFormState(character: Character): StormwightFormState | undefined {
  const kit = activeStormwightKit(character);
  if (!kit) return undefined;
  const raw = currentRuntime(character).stormwight;
  const saved = raw?.kitId === kit.id ? raw : undefined;
  const form = saved?.form ?? "true";
  const transformed = form !== "true";
  const bear = kit.id === "kit.boren";
  const wolf = kit.id === "kit.vuken";
  const crow = kit.id === "kit.corven";
  const rat = kit.id === "kit.raden";
  const hybridSize = saved?.hybridSize ?? (character.size === "1S" ? "1S" : "1M");
  const trueSize = saved?.trueSize ?? character.size;
  const size = !transformed ? trueSize : bear ? "2" : wolf ? "1L" : form === "animal" ? "1T" : hybridSize;
  return {
    kit, form, trueSize, size, hybridSize,
    chooseHybridSize: crow || rat,
    speedBonus: transformed && wolf ? 2 : 0,
    meleeDistanceBonus: transformed && bear ? 1 : 0,
    flight: crow && (form === "animal" || form === "hybrid" && character.level >= 4),
    climb: rat && (form === "animal" || form === "hybrid" && character.level >= 4),
    ignoreDifficultTerrain: rat || transformed && wolf,
    limitedAbilities: form === "animal" && (crow || rat),
    hybridStamina: (bear || wolf) && character.level >= 4,
    description: form === "true" ? "" : kit.formRules?.[form] ?? "",
  };
}

/** Явное снятие/замена runtime важнее авторазмера: это также сохраняет корректность отмены. */
export function synchronizeStormwightForm(previous: Character, next: Character): Character {
  const raw = next.runtime?.stormwight;
  const previousRaw = previous.runtime?.stormwight;
  const kit = activeStormwightKit(next);
  if (!raw || raw.kitId !== kit?.id) {
    if (!raw && !previousRaw) return next;
    const runtime = { ...currentRuntime(next) };
    delete runtime.stormwight;
    const old = previousRaw ?? raw;
    const size = next.automation?.enabled && old && old.form !== "true" && next.size === previous.size
      ? old.trueSize : next.size;
    return { ...next, size, ...(next.runtime ? { runtime } : {}) };
  }
  // В истинной форме ручная правка размера становится новой исходной величиной.
  if (raw.form === "true" && previousRaw === raw && next.size !== previous.size) {
    return { ...next, runtime: { ...currentRuntime(next), stormwight: { ...raw, trueSize: next.size } } };
  }
  if (!next.automation?.enabled) return next;
  const state = stormwightFormState(next)!;
  return next.size === state.size ? next : { ...next, size: state.size };
}

/** Состояние перехода; размер и скорость применяются общим пересчётом листа. */
export function withStormwightForm(character: Character, form: StormwightForm, hybridSize?: "1S" | "1M"): Character {
  const clean = synchronizeStormwightForm(character, character);
  const state = stormwightFormState(clean);
  if (!state) return clean;
  const saved: StormwightFormRuntime = {
    kitId: state.kit.id, form,
    trueSize: state.form === "true" ? clean.size : state.trueSize,
    hybridSize: hybridSize ?? state.hybridSize,
  };
  return { ...clean, runtime: { ...currentRuntime(clean), stormwight: saved } };
}

/** Hide — явное исключение в правилах маленьких форм; прочие способности запрещены. */
export function stormwightAbilityRestriction(character: Character, ability: Ability): string | undefined {
  const state = stormwightFormState(character);
  if (!state?.limitedAbilities) return undefined;
  const id = canonicalAbilityId(ability.id);
  if ([ASPECT_OF_THE_WILD, "feature.ability.common.hide", "hide"].includes(id)) return undefined;
  return `В форме ${state.kit.animalForm === "Ворон" ? "ворона" : "крысы"} доступны только «Аспект дикой природы» и Скрытность. Смените форму, чтобы использовать эту способность.`;
}
