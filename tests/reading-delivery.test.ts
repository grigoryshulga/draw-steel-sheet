import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { CATALOG, GLOSSARY, plainSummary } from "../src/data/library";
import { READING_CATALOG, READING_GLOSSARY } from "../src/rules/consumer-reading";
import { REFERENCE_PREVIEW } from "../src/rules/consumer-reference-preview";
import { CANONICAL_LEVEL_UP_RULES } from "../src/rules/consumer-level-up";
import { LEVEL_UP_GRANTS } from "../src/rules/consumer-level-up-grants";
import type { RuleManifest, RulePack } from "../src/rules/schema";
import { CANONICAL_BUILDER_DATA } from "../src/rules/consumer-builder";
import { CANONICAL_KITS } from "../src/rules/consumer-kits";

const read = (name: string) => JSON.parse(readFileSync(path.join("src/generated/rules", name), "utf8"));

describe("compact reading delivery", () => {
  it("preserves every link target and the exact tooltip text", () => {
    expect(READING_CATALOG).toEqual(CATALOG.map(({ id, kind, name, articleId, heading }) => ({ id, kind, name, articleId, heading })));
    expect(READING_GLOSSARY).toEqual(GLOSSARY.map(({ id, name, english, markdown }) => ({ id, name, english, summary: plainSummary(markdown) })));
  });

  it("preserves the reference list and search fields without builder choices", () => {
    expect(REFERENCE_PREVIEW.ancestries).toEqual(CANONICAL_BUILDER_DATA.ancestries.map(({ articleId, name, summary, signature }) => ({ articleId, name, summary, signature })));
    expect(REFERENCE_PREVIEW.careers).toEqual(CANONICAL_BUILDER_DATA.careers.map(({ articleId, name, benefits }) => ({ articleId, name, benefits })));
    expect(REFERENCE_PREVIEW.classes).toEqual(CANONICAL_BUILDER_DATA.classes.map(({ name, summary, basics }) => ({ name, summary, basics })));
    expect(REFERENCE_PREVIEW.kits).toEqual(CANONICAL_KITS.flatMap((kit) => [kit, ...(kit.variants ?? [])]).map((kit) => ({
      id: kit.id, name: kit.name, summary: kit.summary, equipment: kit.equipment,
      signatureAbility: kit.signatureAbility, familyId: kit.familyId ?? "",
      animalForm: kit.animalForm ?? "", storm: kit.storm ?? "", damageType: kit.damageType ?? "", originalName: kit.originalName ?? "",
    })));
    expect(REFERENCE_PREVIEW.kits.every((kit) => !("growingFerocity" in kit) && !("originalDescription" in kit))).toBe(true);
  });

  it("keeps all subclass grant identities without unrelated level-up data", () => {
    expect(LEVEL_UP_GRANTS).toEqual(CANONICAL_LEVEL_UP_RULES.map(({ className, level, grantedAbilities }) =>
      ({ className, level, ...(grantedAbilities ? { grantedAbilities } : {}) })));
  });

  it("ships each complete article with exactly its referenced entities", () => {
    const manifest = read("manifest.json") as RuleManifest;
    const packs = new Map(manifest.articles.map((entry) => [entry.packId, read(`packs/${entry.packId}.json`) as RulePack]));
    const entities = new Map([...packs.values()].flatMap((pack) => pack.entities.map((entity) => [entity.id, entity] as const)));
    for (const entry of manifest.articles) {
      const single = read(`articles/${entry.id}.json`);
      const original = packs.get(entry.packId)!.articles.find((article) => article.id === entry.id)!;
      expect(single.articles, entry.id).toEqual([original]);
      const refs = [...new Set(original.blocks.filter((block) => block.type === "entity").map((block) => block.ref))];
      expect(single.entities, entry.id).toEqual(refs.map((id) => entities.get(id)));
    }
  });
});
