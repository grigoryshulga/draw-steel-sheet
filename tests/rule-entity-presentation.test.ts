import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AbilityCard } from "../src/components/AbilityCard";
import { RuleArticleContent } from "../src/components/rules/RuleArticle";
import { RuleEntityView } from "../src/components/rules/RuleEntity";
import { createCharacter } from "../src/lib/defaults";
import { BASIC_ABILITY_SOURCE } from "../src/lib/ability-sheet-groups";
import { TIER_ROLL_RANGES, characteristicShort } from "../src/lib/rules";
import { CHARACTERISTIC_KEYS, type Ability } from "../src/types";
import type { RuleArticle, RuleEntity } from "../src/rules/schema";

function abilityFixture(overrides: Partial<Ability> = {}): Ability {
  return {
    id: "ability:test",
    name: "Тестовая способность",
    flavor: "Короткая присказка.",
    actionType: "main",
    kind: "signature",
    keywords: ["Магия", "Ближний"],
    distance: "Ближний 1",
    target: "Одно существо",
    rollCharacteristics: ["might"],
    preferredCharacteristic: "might",
    rollBonus: 1,
    resourceCost: 2,
    trigger: "",
    tiers: [
      { damage: "5 + М", effect: "Первый эффект." },
      { damage: "7 + М", effect: "Второй эффект." },
      { damage: "9 + М", effect: "Третий эффект." },
    ],
    effect: "Краткий эффект из справочника.",
    source: "Класс: Тест",
    notes: "",
    ...overrides,
  };
}

const fullMarkdown = [
  "## Дополнительно",
  "",
  "[Правило](#/codex/0801) и **важное** уточнение.",
  "",
  "**Эффект:** Полное описание эффекта тира из источника.",
  "",
  "- Первый пункт",
  "  - Вложенный пункт",
  "",
  "| Дополнение | Значение |",
  "|---|---|",
  "| Особое | 42 |",
  "",
  "> Заметка мастера.",
  "",
  "Полный текст, которого нет в структурной проекции.",
].join("\n");

function abilityEntity(overrides: Partial<RuleEntity> = {}): RuleEntity {
  return {
    id: "ability:test",
    kind: "ability",
    name: "Тестовая способность",
    markdown: fullMarkdown,
    source: { articleId: "0805", path: "content/rules/entities/ability/test.json" },
    legacyIds: ["legacy-1"],
    ability: abilityFixture(),
    ...overrides,
  };
}

function articleFixture(blocks: RuleArticle["blocks"]): RuleArticle {
  return {
    id: "0805",
    title: "Тестовая статья",
    chapter: "08. Классы",
    group: "Тест",
    path: "content/rules/articles/08/0805.json",
    blocks,
  };
}

describe("RuleEntityView: чтение без героя", () => {
  it("рендерит способность по напечатанным значениям и не требует Character", () => {
    const html = renderToStaticMarkup(
      createElement(RuleEntityView, { entity: abilityEntity() }),
    );

    expect(html).toContain('data-rule-entity="ability:test"');
    expect(html).toContain('id="rule-entity-ability:test"');
    expect(html).toContain("Тестовая способность");
    expect(html).toContain("sheet-ability-meta");
    expect(html).toContain("Ближний 1");
    expect(html).toContain("Одно существо");
    expect(html).toContain("Магия");
    for (const tier of [1, 2, 3]) {
      expect(html).toContain(`data-tier="${tier}"`);
    }
    // Сокращённая проекция не выдаёт себя за полное описание: текст эффекта
    // приходит только из markdown источника.
    expect(html).not.toContain("Краткий эффект из справочника.");
    expect(html).toContain("Полное описание эффекта тира из источника.");
    expect(html).toContain("Бросок");
  });

  it("сохраняет полный markdown источника, ссылки, вложенные списки и таблицы", () => {
    const html = renderToStaticMarkup(
      createElement(RuleEntityView, { entity: abilityEntity() }),
    );

    expect(html).toContain('href="#/codex/0801"');
    expect(html).toContain("Вложенный пункт");
    expect(html).toContain("<table>");
    expect(html).toContain("42");
    expect(html).toContain("Заметка мастера.");
    expect(html).toContain('id="дополнительно"');
    // Структурная проекция не заменяет текст, которого в ней нет.
    expect(html).toContain(
      "Полный текст, которого нет в структурной проекции.",
    );
  });

  it("помечает базовые способности тем же источником, что и лист", () => {
    const html = renderToStaticMarkup(
      createElement(RuleEntityView, {
        entity: abilityEntity({
          ability: abilityFixture({ source: BASIC_ABILITY_SOURCE }),
        }),
      }),
    );

    expect(html).toContain("Базовая");
  });

  it("подписи броска и тиров совпадают с правилами листа", () => {
    for (const key of CHARACTERISTIC_KEYS) {
      const html = renderToStaticMarkup(
        createElement(RuleEntityView, {
          entity: abilityEntity({
            ability: abilityFixture({
              rollCharacteristics: [key],
              rollBonus: 2,
            }),
          }),
        }),
      );
      expect(html).toContain(
        `<em>Бросок</em> ${characteristicShort(key)} +2`,
      );
    }

    const html = renderToStaticMarkup(
      createElement(RuleEntityView, { entity: abilityEntity() }),
    );
    for (const tier of [1, 2, 3] as const) {
      expect(html).toContain(TIER_ROLL_RANGES[tier]);
    }
  });

  it("рендерит сущность без структурной способности как обычное правило", () => {
    const entity: RuleEntity = {
      id: "feature:test",
      kind: "feature",
      name: "Тестовая особенность",
      markdown: "**Эффект:** работает всегда.\n\n- Один\n- Два",
      source: { articleId: "0801", path: "content/rules/entities/feature/test.json" },
      legacyIds: [],
    };

    const html = renderToStaticMarkup(
      createElement(RuleEntityView, { entity }),
    );

    expect(html).toContain("Особенность");
    expect(html).toContain("Тестовая особенность");
    expect(html).toContain("работает всегда.");
    expect(html).toContain("<li>Один</li>");
    expect(html).not.toContain("sheet-ability-meta");
  });
});

describe("RuleArticleContent: блоки статьи", () => {
  it("выводит markdown и сущности в порядке блоков статьи", () => {
    const html = renderToStaticMarkup(
      createElement(RuleArticleContent, {
        article: articleFixture([
          { type: "markdown", text: "Вступление статьи." },
          { type: "entity", ref: "ability:test" },
          { type: "markdown", text: "Завершающий абзац." },
        ]),
        entities: { "ability:test": abilityEntity() },
      }),
    );

    expect(html).toContain('data-rule-article="0805"');
    expect(html.indexOf("Вступление статьи.")).toBeLessThan(
      html.indexOf("Тестовая способность"),
    );
    expect(html.indexOf("Тестовая способность")).toBeLessThan(
      html.indexOf("Завершающий абзац."),
    );
  });

  it("показывает неразрешённую ссылку детерминированно и не подставляет правило", () => {
    const article = articleFixture([
      { type: "entity", ref: "feature:missing" },
      { type: "entity", ref: "ability:test" },
    ]);
    const render = () =>
      renderToStaticMarkup(
        createElement(RuleArticleContent, {
          article,
          entities: { "ability:test": abilityEntity() },
        }),
      );

    const first = render();
    const second = render();

    expect(first).toBe(second);
    expect(first).toContain('data-entity-ref="feature:missing"');
    expect(first).toContain('data-state="unresolved"');
    expect(first).toContain("Правило не загружено");
    expect(first).toContain("feature:missing");
    expect(first).not.toContain("Тестовая особенность");
    expect(first).toContain("Тестовая способность");
  });

  it("пропускает пустые markdown-блоки, не теряя соседние сущности", () => {
    const html = renderToStaticMarkup(
      createElement(RuleArticleContent, {
        article: articleFixture([
          { type: "markdown", text: "   \n" },
          { type: "entity", ref: "ability:test" },
        ]),
        entities: { "ability:test": abilityEntity() },
      }),
    );

    expect(html.trim()).not.toBe("");
    expect(html).toContain("Тестовая способность");
  });
});

describe("AbilityCard: совместимость с листом", () => {
  it("сохраняет публичные классы и показывает расчёты героя", () => {
    const html = renderToStaticMarkup(
      createElement(AbilityCard, {
        ability: abilityFixture({ source: "Класс: Тест" }),
        character: createCharacter({ name: "Герой" }),
        origin: { label: "Орден", value: "Рассвет" },
        selected: true,
      }),
    );

    expect(html).toContain("sheet-ability-card");
    expect(html).toContain("is-selected");
    expect(html).toContain('data-action="main"');
    expect(html).toContain('data-kind="signature"');
    expect(html).toContain("Тестовая способность");
    expect(html).toContain("Орден");
    expect(html).toContain("sheet-ability-meta");
    expect(html).toContain("sheet-ability-keyword");
    expect(html).toContain('data-tier="1"');
    expect(html).toContain("sheet-ability-body");
    expect(html).toContain("Первый эффект.");
    expect(html).toContain("sheet-ability-footer");
    expect(html).toContain("Бросок");
  });

  it("использует те же части презентации, что и чтение правил", () => {
    const card = renderToStaticMarkup(
      createElement(AbilityCard, {
        ability: abilityFixture({ source: "Класс: Тест" }),
        character: createCharacter({ name: "Герой" }),
      }),
    );
    const reference = renderToStaticMarkup(
      createElement(RuleEntityView, { entity: abilityEntity() }),
    );

    for (const marker of [
      "sheet-ability-meta",
      "sheet-ability-keywords",
      "sheet-ability-tiers",
      "sheet-ability-tier",
    ]) {
      expect(card).toContain(marker);
      expect(reference).toContain(marker);
    }
  });
});
