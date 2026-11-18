import { CANONICAL_KITS } from "../rules/consumer-kits";
import type { ConsumerKit, ConsumerKitBonus } from "../rules/consumer-data";
import type { Ability, Character } from "../types";
import { canUseKit } from "./creation-rules";

export type KitBonus = ConsumerKitBonus;
export type Kit = ConsumerKit;

export const KIT_COMPENDIUM: Kit[] = CANONICAL_KITS;
export const SELECTABLE_KITS: Kit[] = KIT_COMPENDIUM.flatMap((kit) => kit.variants ?? [kit]);

/** Буревестник выбирает один из четырёх своих комплектов; остальные классы — обычные. */
export function availableKits(className: string, subclass: string): Kit[] {
  if (!canUseKit(className, subclass)) return [];
  const stormwight = className === "Неистовый" && ["буревестник", "fury.aspect.stormbringer"].includes(normalizeKitName(subclass));
  return SELECTABLE_KITS.filter((kit) => Boolean(kit.familyId) === stormwight);
}

export function selectableKitByName(name: string, className: string, subclass: string): Kit | undefined {
  const kit = kitByName(name);
  return kit && availableKits(className, subclass).includes(kit) ? kit : undefined;
}

type KitSelection = Pick<Character, "className" | "subclass" | "kit" | "secondaryKit">;

export function kitSlotSelection(loadout: KitSelection, secondary: boolean) {
  const paired = loadout.className === "Тактик";
  const otherKit = paired ? kitByName(secondary ? loadout.kit : loadout.secondaryKit ?? "") : undefined;
  const kits = availableKits(loadout.className, loadout.subclass);

  function issue(kit: Kit | undefined) {
    if (secondary && !paired) return "Второй комплект доступен только тактику.";
    if (!kit) return; // Название своего комплекта или очистка слота в инвентаре.
    if (!kits.includes(kit)) return "Этот комплект недоступен выбранному классу или аспекту.";
    if (kit.id === otherKit?.id) return "Этот комплект уже выбран. Выберите два разных комплекта.";
  }

  return { kits, otherKit, issue };
}

function normalizeKitName(name: string): string {
  return name.trim().toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ");
}

export function kitByName(name: string): Kit | undefined {
  const needle = normalizeKitName(name);
  if (!needle) return undefined;
  return [...KIT_COMPENDIUM, ...SELECTABLE_KITS].find((kit) => normalizeKitName(kit.name) === needle);
}

/** У старых карточек всех четырёх комплектов общий источник «Буревестник». */
export function abilitySourceKit(ability: Pick<Ability, "source" | "name">): Kit | undefined {
  if (!ability.source.startsWith("Комплект: ")) return undefined;
  const kit = kitByName(ability.source.slice(10));
  return kit?.variants
    ? kit.variants.find((variant) => variant.signatureAbility === ability.name)
    : kit;
}

export { kitBonusLabel } from "./kit-bonuses";
