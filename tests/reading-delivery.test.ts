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
    expect(REFERENCE_PREVIEW.ancestries).toEqual(CANONICAL_BUILDER_DATA.ancestries.map(({ articleId, name, summary, signature, originalName, originalId }) => ({ articleId, name, summary, signature, originalName, originalId })));
    expect(REFERENCE_PREVIEW.careers).toEqual(CANONICAL_BUILDER_DATA.careers.map(({ articleId, name, benefits, originalName, originalId }) => ({ articleId, name, benefits, originalName, originalId })));
    expect(REFERENCE_PREVIEW.classes).toEqual(CANONICAL_BUILDER_DATA.classes.map(({ name, summary, basics, originalName, originalId }) => ({ name, summary, basics, originalName, originalId })));
    expect(REFERENCE_PREVIEW.kits).toEqual(CANONICAL_KITS.flatMap((kit) => [kit, ...(kit.variants ?? [])]).map((kit) => ({
      id: kit.id, name: kit.name, summary: kit.summary, equipment: kit.equipment,
      signatureAbility: kit.signatureAbility, familyId: kit.familyId ?? "",
      animalForm: kit.animalForm ?? "", storm: kit.storm ?? "", damageType: kit.damageType ?? "", originalName: kit.originalName ?? "", originalId: kit.originalId ?? "",
    })));
    expect(REFERENCE_PREVIEW.kits.every((kit) => !("growingFerocity" in kit) && !("originalDescription" in kit))).toBe(true);
  });

  it("keeps all subclass grant identities without unrelated level-up data", () => {
    expect(LEVEL_UP_GRANTS).toEqual(CANONICAL_LEVEL_UP_RULES.map(({ className, level, grantedAbilities }) =>
      ({ className, level, ...(grantedAbilities ? { grantedAbilities } : {}) })));
  });

  it("ships each complete article with exactly its referenced entities", () => {
    const manifest = read("manifest.json") as RuleManifest;
    const packIds = new Set(manifest.articles.map(entry => entry.packId));
    const packs = new Map([...packIds].map(id => [id, read(`packs/${id}.json`) as RulePack]));
    const entities = new Map([...packs.values()].flatMap((pack) => pack.entities.map((entity) => [entity.id, entity] as const)));
    for (const entry of manifest.articles) {
      const single = read(`articles/${entry.id}.json`);
      const original = packs.get(entry.packId)!.articles.find((article) => article.id === entry.id)!;
      expect(single.articles, entry.id).toEqual([original]);
      const refs = [...new Set([...original.blocks, ...(original.englishEdition?.blocks ?? [])].filter((block) => block.type === "entity").map((block) => block.ref))];
      const signatures = refs.flatMap(id => entities.get(id)?.englishSignatures?.map(signature => signature.ref) ?? []);
      const expected = [...new Set([...refs, ...signatures])];
      expect(single.entities, entry.id).toEqual(expected.map(id => entities.get(id)));
    }
  });
});
