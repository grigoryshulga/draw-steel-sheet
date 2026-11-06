import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BuilderStepProvider, type BuilderStepContextValue } from "../src/components/builder/BuilderStepContext";
import { AncestryOptionsStep } from "../src/components/builder/steps/AncestryOptionsStep";
import { ancestryTraitAbilities, ancestryTraitChoice } from "../src/lib/ancestry-features";
import { buildCharacter, builderSkillSlots, BUILDER_DATA, emptyBuilderDraft, type BuilderDraft } from "../src/lib/character-builder";

function renderStep(draft: BuilderDraft) {
  const value = {
    draft,
    patch() {},
    go() {},
    openTrait() {},
    hero: buildCharacter(draft),
    skillSlots: builderSkillSlots(draft),
    ancestrySkills: [],
  } as unknown as BuilderStepContextValue;
  return renderToStaticMarkup(createElement(BuilderStepProvider, {
    value,
    children: createElement(AncestryOptionsStep),
  }));
}

function traitCard(html: string, name: string) {
  const card = html.split("<article ").find((part) => part.includes(`Открыть: ${name}`));
  expect(card).toBeDefined();
  return card!.split("</article>")[0];
}

function expectSingleCard(card: string) {
  expect(card).toContain("Черта происхождения");
  expect(card).toContain("ability-card-content");
  expect(card).toContain("sheet-ability-meta");
  expect(card).not.toContain("sheet-ability-card-head");
  expect(card).not.toContain("<h4");
}

describe("способность внутри черты происхождения", () => {
  it("показывает параметры и тиры Наследия драконов без второй шапки и повторного названия", () => {
    const ancestry = BUILDER_DATA.ancestries.find((item) => item.name === "Ящер")!;
    const trait = ancestry.traits.find((item) => ancestryTraitAbilities(ancestry.name, item.name).length > 0)!;
    const card = traitCard(renderStep({ ...emptyBuilderDraft(), ancestry: ancestry.name }), trait.name);
    expectSingleCard(card);
    expect(card).toContain(`${trait.cost} очк.`);
    expect(card).toContain("sheet-ability-tiers");
    expect(card).toContain("Знаковая");
    expect(card).not.toContain("ability-card-content-name");
    expect(card).toContain('aria-pressed="false"');
  });

  it("показывает выбранную способность под переключателем без вложенной карточки", () => {
    const ancestry = BUILDER_DATA.ancestries.find((item) => item.traits.some((trait) => ancestryTraitChoice(item.name, trait.name)))!;
    const trait = ancestry.traits.find((item) => ancestryTraitChoice(ancestry.name, item.name))!;
    const choice = ancestryTraitChoice(ancestry.name, trait.name)!;
    const option = choice.options[0];
    const draft = {
      ...emptyBuilderDraft(),
      ancestry: ancestry.name,
      traits: [trait.name],
      ancestryChoices: { [choice.group]: option.id },
    };
    const card = traitCard(renderStep(draft), trait.name);
    expectSingleCard(card);
    expect(card).toContain(`${trait.name}: выберите способность`);
    expect(card).toContain(`value="${option.id}" selected`);
    expect(card).toContain('aria-pressed="true"');

    const unselected = traitCard(renderStep({ ...draft, traits: [] }), trait.name);
    expect(unselected).not.toContain("ability-card-content");
    expect(unselected).toContain("Выберите черту");
  });
});
