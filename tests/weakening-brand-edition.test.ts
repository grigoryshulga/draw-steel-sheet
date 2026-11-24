import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { ArticleLanguageScope } from "../src/i18n/locale";
import { kitVariantEntity } from "../src/rules/kit-variants";
import { RuleArticleContent } from "../src/components/rules/RuleArticle";
import { RuleEntityView } from "../src/components/rules/RuleEntity";
import { AbilityBody } from "../src/components/rules/AbilitySheet";
import { abilityCardView } from "../src/components/rules/abilityCardView";
import { printedAbilityView } from "../src/components/rules/printedAbilityView";
import { ABILITY_COMPENDIUM } from "../src/data/compendium";
import { buildCharacter, emptyBuilderDraft, startingCharacteristics } from "../src/lib/character-builder";
import type { RuleEntity } from "../src/rules/schema";
import type { PrintedAbility } from "../src/rules/printed-ability";

const read = (path: string) => JSON.parse(readFileSync(path, "utf8"));
const entity = (read("src/generated/rules/articles/0906.json").entities as RuleEntity[]).find(e => e.originalName === "Weakening Brand")!;
const printed: PrintedAbility = read("src/generated/consumers/ability-cards-en.json")[entity.id];
const ability = ABILITY_COMPENDIUM.find(entry => entry.id === entity.id)!;

it("keeps Weakening Brand’s printed rules and calculates a hero’s damage independently of the edition", () => {
  expect(printed).toEqual(entity.printedAbility);
  const article = renderToStaticMarkup(createElement(ArticleLanguageScope, { language: "en", children: createElement(RuleEntityView, { entity }) }));
  expect(article).toContain("Weakening Brand");
  expect(article).toContain("One creature or object");
  expect(article).toContain("Melee 1");
  expect(article.match(/data-tier=/g)).toHaveLength(3);
  expect(printed.roll?.tiers.map(row => row.damage)).toEqual(
    [3, 5, 8].map(value => ({ value: value + " + M, R, I, or P", type: "holy" })),
  );
  const hero = buildCharacter({ ...emptyBuilderDraft(), className: "Тактик", characteristics: startingCharacteristics("Тактик"), kit: "Гора" });
  hero.damageModifier = 2;
  const before = structuredClone(hero);
  const base = abilityCardView(ability, hero);
  const sheet = printedAbilityView(base, printed, base.cardModifiers);
  expect(sheet.tiers.map(t => t.damage?.value)).toEqual(base.tiers.map(t => t.damage?.value));
  // The printed Warrior Priest kit bonuses are replaced by Mountain’s tier bonuses.
  expect(sheet.tiers.map(t => t.damage?.value)).toEqual(["6", "8", "15"]);
  const html = renderToStaticMarkup(createElement(AbilityBody, { view: sheet, full: true, language: "en" }));
  for (const markup of [html, article]) expect(markup).toContain("they have damage weakness equal to the characteristic score");
  expect(hero).toEqual(before);
});

it("renders the Warrior Priest signature from its ability ID once in the full English kit article", () => {
  const pack = read("src/generated/rules/articles/0906.json");
  const entities = Object.fromEntries(pack.entities.map((entry: RuleEntity) => [entry.id, entry]));
  const article = renderToStaticMarkup(createElement(ArticleLanguageScope, { language: "en",
    children: createElement(RuleArticleContent, { article: pack.articles[0], entities }),
  }));
  expect(article).toContain("Melee Damage Bonus");
  expect(article).toContain('id="weakening-brand"');
  expect(article).toContain(`data-rule-entity="${entity.id}"`);
  expect(article.match(/data-tier=/g)).toHaveLength(3);
  expect(article.match(/data-type="holy"/g)).toHaveLength(3);
});

it("keeps a Stormwight variant’s signature attached to its own article excerpt", () => {
  const { entities: records } = read("src/generated/rules/articles/0924.json") as { entities: RuleEntity[] };
  const entities = Object.fromEntries(records.map(entry => [entry.id, entry]));
  const family = entities["kit.stormwight"];
  for (const kit of family.kitVariants!) {
    const entity = kitVariantEntity(family, kit.name)!;
    const article = renderToStaticMarkup(createElement(ArticleLanguageScope, { language: "en",
      children: createElement(RuleEntityView, { entity, entities }),
    }));
    expect(article).toContain(`data-rule-entity="${kit.signatureAbilityId}"`);
    for (const other of family.kitVariants!.filter(other => other !== kit)) expect(article).not.toContain(other.signatureAbilityId);
    expect(article).toContain("Shared Stormwight Features");
  }
});
