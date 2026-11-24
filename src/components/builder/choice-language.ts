import { basicActionSource } from "../../data/templates";
import { BUILDER_DATA } from "../../lib/character-builder";
import { SKILL_ORIGINALS } from "../../data/skills";
import { SELECTABLE_KITS } from "../../data/kits";
import { PERK_COMPENDIUM } from "../../data/perks";
import type { Locale } from "../../i18n/locale";
import { useLocalizedData } from "../../i18n/use-localized-data";
import { loadBuilderOptions } from "../../rules/consumer-english-reference";

const records = [...BUILDER_DATA.ancestries, ...BUILDER_DATA.ancestries.flatMap(a => a.traits),
  ...BUILDER_DATA.careers, ...BUILDER_DATA.classes, ...Object.values(BUILDER_DATA.cultures).flat(),
  ...BUILDER_DATA.complications, ...SELECTABLE_KITS, ...PERK_COMPENDIUM];
const names = new Map(records.filter(r => r.originalName).map(r => [r.name, r.originalName!]));

/** Display only catalog selections. Never pass a player's name or authored notes here. */
export function useBuilderNames(locale: Locale, className: string) {
  const options = useLocalizedData(locale, loadBuilderOptions);
  return (value = ""): string => locale === "ru" ? value : options?.[className]?.[value]?.name
    ?? names.get(value) ?? SKILL_ORIGINALS[value]?.originalName ?? value;
}

export function careerIncident(career: { originalDescription?: string; incidents: string[] }, index: number, locale: Locale) {
  const ru = career.incidents[index] ?? "";
  const original = career.originalDescription ?? "";
  const rows = [...original.matchAll(/^\|\s*(\d+)\s*\|\s*\*\*(.+?):\*\*\s*(.*?)\s*\|\s*$/gm)];
  // The Sailor source prints the same six outcomes as paragraphs following the heading.
  const paragraphs = [...(original.split(/\n[^\n]*\bInciting Incident\b[^\n]*\n/i)[1] ?? "").matchAll(/^\*\*(.+?):\*\*\s*(.+)$/gm)];
  if (locale === "en" && rows.length === career.incidents.length && Number(rows[index]?.[1]) === index + 1)
    return { title: rows[index][2], text: rows[index][3] };
  if (locale === "en" && paragraphs.length === career.incidents.length && paragraphs[index])
    return { title: paragraphs[index][1], text: paragraphs[index][2] };
  const colon = ru.indexOf(":");
  return { title: colon < 0 ? ru : ru.slice(0, colon).trim(), text: colon < 0 ? "" : ru.slice(colon + 1).trim() };
}

/** Translate only the unmodified basic actions supplied by the sheet. */
export function builderAbilityName(ability: { name: string; source: string; originalName?: string }, locale: Locale): string {
  if (locale !== "en") return ability.name;
  if (ability.originalName) return ability.originalName;
  return basicActionSource(ability)?.name ?? ability.name;
}
