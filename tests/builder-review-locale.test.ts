import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import options from "../src/generated/consumers/builder-options-en.json";
import { buildCharacter, emptyBuilderDraft } from "../src/lib/character-builder";
import { builderFlow } from "../src/lib/builder-flow";
import { deriveStats } from "../src/lib/rules";
import { createCharacter } from "../src/lib/defaults";

vi.mock("../src/i18n/locale", () => ({ useLocale: () => ({ locale: "en", t: (_ru: string, en: string) => en }) }));
vi.mock("../src/i18n/use-localized-data", () => ({ useLocalizedData: () => options }));
let state: unknown;
vi.mock("../src/components/builder/BuilderStepContext", () => ({ useBuilderStep: () => state }));
import { SummaryStep } from "../src/components/builder/steps/SummaryStep";
import { BuilderPreview } from "../src/components/builder/BuilderPreview";
import { builderAbilityName } from "../src/components/builder/choice-language";

describe("builder review language", () => {
  it("renders the saved Censor choices and basic strikes in English without changing the draft", () => {
    const draft = { ...emptyBuilderDraft(), name: "Censor QA", ancestry: "Дварф", className: "Цензор", subclass: "Экзорцист", domain: "Жизнь", kit: "Гора", abilityIds: ["feature.ability.censor.level-1.every-step-death", "feature.ability.censor.level-1.the-gods-punish-and-defend", "feature.ability.censor.level-1.arrest"] };
    const before = structuredClone(draft);
    const seed = createCharacter();
    const hero = buildCharacter(draft, seed);
    state = { draft, hero, flow: builderFlow(draft), goToFlow: vi.fn() };
    const review = renderToStaticMarkup(createElement(SummaryStep));
    const preview = renderToStaticMarkup(createElement(BuilderPreview, { hero, draftName: draft.name, derived: deriveStats(hero), seedAbilities: [], busy: false, onReset: vi.fn() }));
    expect(review).toContain("Exorcist · Life");
    for (const html of [review, preview]) {
      expect(html).toContain("Melee Weapon Free Strike");
      expect(html).toContain("Ranged Weapon Free Strike");
      expect(html).not.toContain("Свободный удар ближнего боя");
    }
    expect(draft).toEqual(before);
    expect(builderAbilityName({ name: "Мой удар", source: "Базовые способности" }, "en")).toBe("Мой удар");
    expect(builderAbilityName({ name: "Свободный удар ближнего боя", source: "Своя способность" }, "en")).toBe("Свободный удар ближнего боя");
  });
});
