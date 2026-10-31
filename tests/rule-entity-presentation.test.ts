import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AbilityCard } from "../src/components/AbilityCard";
import { RuleArticleContent } from "../src/components/rules/RuleArticle";
import { RuleEntityView } from "../src/components/rules/RuleEntity";
import { createCharacter } from "../src/lib/defaults";
import { BASIC_ABILITY_SOURCE } from "../src/lib/ability-sheet-groups";
import { TIER_ROLL_RANGES, characteristicShort } from "../src/lib/rules";
import { normalizeAbilityText } from "../src/lib/remark-ability-blocks";
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
    trigger: "Цель получает урон.",
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

/**
 * Реалистичная цитата-карточка источника: заголовок, флейвор, таблица 📏/🎯,
 * триггер, бросок силы, тиры, эффект и два «допблока», которых в структурной
 * проекции нет.
 */
const abilityCardMarkdown = [
  "> **Тестовая способность**",
  ">",
  "> *Короткая присказка.*",
  ">",
  "> | **Магия, Ближний** | **Основное действие** |",
  "> | --- | ---: |",
  "> | **📏 Ближний 1** | **🎯 Одно существо** |",
  ">",
  "> **Триггер:** Цель атакует вас.",
  ">",
  "> **Бросок силы + Мощь:**",
  ">",
  "> - **≤11:** 5 + М урона",
  "> - **12-16:** 7 + М урона",
  "> - **17+:** 9 + М урона",
  ">",
  "> **Эффект:** Цель теряет Восстановление.",
  ">",
  "> **Поддержание 1:** Область остаётся до начала вашего следующего хода.",
  ">",
  "> **Потратить 1 Эссенцию:** Вы наносите дополнительно 1d6 урона.",
].join("\n");

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
    markdown: abilityCardMarkdown,
    source: { articleId: "0805", path: "content/rules/entities/ability/test.json" },
    legacyIds: ["legacy-1"],
    ability: abilityFixture(),
    ...overrides,
  };
}

function renderEntity(entity: RuleEntity): string {
  return renderToStaticMarkup(createElement(RuleEntityView, { entity }));
}

function extrasHtml(html: string): string {
  const marker = 'class="rule-text rule-entity-extras">';
  const at = html.indexOf(marker);
  if (at < 0) return "";
  return html
    .slice(at + marker.length)
    .replace(/<\/div><\/section>$/, "");
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

describe("RuleEntityView: одна полная карточка способности", () => {
  it("показывает факты, метки, тиры с эффектами, полный эффект, триггер и флейвор", () => {
    const html = renderEntity(abilityEntity());

    expect(html).toContain('data-rule-entity="ability:test"');
    expect(html).toContain('id="rule-entity-ability:test"');
    expect(html).toContain("class=\"sheet-ability-card is-full\"");
    expect(html).toContain('data-action="main"');
    expect(html).toContain('data-kind="signature"');

    // Факты книги, метки и бросок — та же семантика, что у карточки листа.
    expect(html).toContain("sheet-ability-meta");
    expect(html).toContain("Ближний 1");
    expect(html).toContain("Одно существо");
    expect(html).toContain("sheet-ability-keyword");
    expect(html).toContain("Магия");
    expect(html).toContain(
      `<em>Бросок</em> ${characteristicShort("might")} +1`,
    );

    // Карточка полная: у каждого тира есть и урон, и эффект.
    for (const tier of [1, 2, 3]) {
      expect(html).toContain(`data-tier="${tier}"`);
      expect(html).toContain(TIER_ROLL_RANGES[tier as 1 | 2 | 3]);
    }
    expect(html).toContain("Первый эффект.");
    expect(html).toContain("Второй эффект.");
    expect(html).toContain("Третий эффект.");
    expect(html).toContain("sheet-ability-body");
    expect(html).toContain("Краткий эффект из справочника.");

    // Флейвор и триггер из структурной проекции.
    expect(html).toContain('class="rule-ability-flavor"');
    expect(html).toContain("Короткая присказка.");
    expect(html).toContain('class="rule-ability-trigger"');
    expect(html).toContain("Цель получает урон.");

    // Вид способности показывает чип «Знаковая», а не чип вида сущности.
    expect(html).toContain("Знаковая");
    expect(html).not.toContain("Способность");
    expect(html).not.toContain("rule-entity-kind");
  });

  it("не дублирует карточку из markdown: заголовок и таблица 📏/🎯 убраны", () => {
    const html = renderEntity(abilityEntity());

    const names = html.match(/Тестовая способность/g) ?? [];
    expect(names).toHaveLength(1);
    expect(html).not.toContain("📏");
    expect(html).not.toContain("🎯");
    expect(html).not.toContain("<table>");
  });

  it("оставляет из цитаты только то, чего карточка не показывает", () => {
    const html = renderEntity(abilityEntity());

    // Допблоки источника на месте и развёрнуты из цитаты в поток статьи.
    expect(html).toContain('class="rule-text rule-entity-extras"');
    expect(html).toContain("Поддержание 1:");
    expect(html).toContain("Область остаётся до начала вашего следующего хода.");
    expect(html).toContain("Потратить 1 Эссенцию:");
    expect(html).toContain("Вы наносите дополнительно 1d6 урона.");
    expect(html).not.toContain("<blockquote>");

    // Карточные части цитаты вырезаны.
    expect(html).not.toContain("Бросок силы + Мощь");
    expect(html).not.toContain("≤11:");
    expect(html).not.toContain("12-16:");
    expect(html).not.toContain("17+:");
    expect(html).not.toContain("Цель теряет Восстановление.");
    expect(html).not.toContain("Цель атакует вас.");
    expect(html.match(/Эффект:/g) ?? []).toHaveLength(0);
    // «Триггер» остаётся один раз — подписью карточки, а не абзацем источника.
    expect(html.match(/Триггер:/g) ?? []).toHaveLength(1);
  });

  it("вырезает из остатка оба абзаца «Эффект», если их два", () => {
    const twoEffectsMarkdown = [
      "> **Двойной эффект**",
      ">",
      "> | **Магия** | **Основное действие** |",
      "> | --- | ---: |",
      "> | **📏 Ближний 1** | **🎯 Одно существо** |",
      ">",
      "> **Эффект:** Эффект до броска силы.",
      ">",
      "> **Бросок силы + Мощь:**",
      ">",
      "> - **≤11:** 5 + М урона",
      "> - **12-16:** 7 + М урона",
      "> - **17+:** 9 + М урона",
      ">",
      "> **Эффект:** Эффект после тиров.",
    ].join("\n");

    const html = renderEntity(
      abilityEntity({
        name: "Двойной эффект",
        markdown: twoEffectsMarkdown,
        ability: abilityFixture({
          effect: "Склеенный эффект проекции.",
          trigger: "",
        }),
      }),
    );

    expect(html).toContain("Склеенный эффект проекции.");
    expect(html).not.toContain("Эффект до броска силы.");
    expect(html).not.toContain("Эффект после тиров.");
    expect(html.match(/Эффект:/g) ?? []).toHaveLength(0);
  });

  it("не повторяет под карточкой допблок, уже вошедший в effect", () => {
    const markdown = [
      "> **Проверка дубля**",
      ">",
      "> | **Магия** | **Основное действие** |",
      "> | --- | ---: |",
      "> | **📏 Ближний 1** | **🎯 Одно существо** |",
      ">",
      "> **Эффект:** Краткий эффект.",
      ">",
      "> **Потрать 5 Оч. Судьбы:** Цель получает слабость.",
      ">",
      "> **Особое:** Действует и вне боя.",
    ].join("\n");

    const html = renderEntity(
      abilityEntity({
        name: "Проверка дубля",
        markdown,
        ability: abilityFixture({
          trigger: "",
          effect:
            "Краткий эффект.\n\nПотрать 5 Оч. Судьбы: Цель получает слабость.",
        }),
      }),
    );

    // Показанное карточкой (с переносами \n\n) под ней не повторяется.
    expect(html).toContain("Краткий эффект.");
    expect(extrasHtml(html)).not.toContain("Цель получает слабость.");
    // Допблок, которого в effect нет, остаётся видимым.
    expect(extrasHtml(html)).toContain("Особое:");
    expect(extrasHtml(html)).toContain("Действует и вне боя.");
  });

  it("сравнивает текст без markdown-разметки: эмфазис и ссылки не мешают", () => {
    const markdown = [
      "> **Разметка**",
      ">",
      "> | **Магия** | **Основное действие** |",
      "> | --- | ---: |",
      "> | **📏 Ближний 1** | **🎯 Одно существо** |",
      ">",
      "> **Потрать:** *1 Эссенцию* выдаёт [искру](#/codex/0801).",
    ].join("\n");

    const html = renderEntity(
      abilityEntity({
        name: "Разметка",
        markdown,
        ability: abilityFixture({
          trigger: "",
          effect: "Потрать: 1 Эссенцию выдаёт искру.",
        }),
      }),
    );

    expect(extrasHtml(html)).not.toContain("выдаёт искру.");
  });

  it("оставляет из списка только непокрытые пункты", () => {
    const markdown = [
      "> **Список**",
      ">",
      "> | **Магия** | **Основное действие** |",
      "> | --- | ---: |",
      "> | **📏 Ближний 1** | **🎯 Одно существо** |",
      ">",
      "> **Эффект:** Основной эффект.",
      ">",
      "> - Второй ход: сдвиньте цель",
      "> - Пока поддерживается: цель ослеплена",
    ].join("\n");

    const html = renderEntity(
      abilityEntity({
        name: "Список",
        markdown,
        ability: abilityFixture({
          trigger: "",
          effect: "Основной эффект.\n\nВторой ход: сдвиньте цель",
        }),
      }),
    );

    const extras = extrasHtml(html);
    expect(extras).toContain("Пока поддерживается:");
    expect(extras).toContain("ослеплена");
    expect(extras).not.toContain("сдвиньте цель");
    expect(extras.match(/<li>/g) ?? []).toHaveLength(1);
  });

  it("убирает список целиком, если все его пункты уже показаны", () => {
    const markdown = [
      "> **Полный список**",
      ">",
      "> | **Магия** | **Основное действие** |",
      "> | --- | ---: |",
      "> | **📏 Ближний 1** | **🎯 Одно существо** |",
      ">",
      "> **Эффект:** Основной эффект.",
      ">",
      "> - Первый пункт",
      "> - Второй пункт",
    ].join("\n");

    const html = renderEntity(
      abilityEntity({
        name: "Полный список",
        markdown,
        ability: abilityFixture({
          trigger: "",
          effect: "Основной эффект.\n\nПервый пункт\n\nВторой пункт",
        }),
      }),
    );

    const extras = extrasHtml(html);
    expect(extras).not.toContain("Первый пункт");
    expect(extras).not.toContain("Второй пункт");
    expect(extras.match(/<li>/g) ?? []).toHaveLength(0);
    expect(extras.trim()).toBe("");
  });

  it("не трогает markdown без ability-цитаты", () => {
    const html = renderEntity(abilityEntity({ markdown: fullMarkdown }));

    // Карточка способности рисуется из проекции.
    expect(html).toContain("sheet-ability-meta");
    // А Markdown остаётся целиком: заголовки, ссылки, списки, таблицы, заметки.
    expect(html).toContain('id="дополнительно"');
    expect(html).toContain('href="#/codex/0801"');
    expect(html).toContain("Вложенный пункт");
    expect(html).toContain("<table>");
    expect(html).toContain("42");
    expect(html).toContain("Заметка мастера.");
    expect(html).toContain("Полное описание эффекта тира из источника.");
    expect(html).toContain(
      "Полный текст, которого нет в структурной проекции.",
    );
  });

  it("помечает базовые способности тем же источником, что и лист", () => {
    const html = renderEntity(
      abilityEntity({
        ability: abilityFixture({ source: BASIC_ABILITY_SOURCE }),
      }),
    );

    expect(html).toContain("Базовая");
  });

  it("подписи броска и тиров совпадают с правилами листа", () => {
    for (const key of CHARACTERISTIC_KEYS) {
      const html = renderEntity(
        abilityEntity({
          ability: abilityFixture({
            rollCharacteristics: [key],
            rollBonus: 2,
          }),
        }),
      );
      expect(html).toContain(
        `<em>Бросок</em> ${characteristicShort(key)} +2`,
      );
    }

    const html = renderEntity(abilityEntity());
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

    const html = renderEntity(entity);

    expect(html).toContain("Особенность");
    expect(html).toContain("Тестовая особенность");
    expect(html).toContain("работает всегда.");
    expect(html).toContain("<li>Один</li>");
    expect(html).not.toContain("sheet-ability-card");
    expect(html).not.toContain("sheet-ability-meta");
  });

  it("не дублирует заголовок сущности, повторяющий её имя", () => {
    const entity: RuleEntity = {
      id: "feature.elementalist.earth-acolyte",
      kind: "feature",
      name: "Земля: Аколит Земли",
      markdown:
        "##### Земля: Аколит Земли\n\nВы используете поток магии земли.\n\n##### Второй заголовок\n\nЕщё текст.",
      source: { articleId: "0891", path: "content/rules/entities/feature/test.json" },
      legacyIds: [],
    };

    const html = renderEntity(entity);

    // Имя выводит только `h2` раздела; заголовок источника снят.
    expect(html.match(/Земля: Аколит Земли/g) ?? []).toHaveLength(1);
    expect(html).not.toContain(`<h4 id="земля-аколит-земли">`);
    // Якорь снятого заголовка остаётся у шапки раздела: оглавление ведёт сюда.
    expect(html).toContain(`id="земля-аколит-земли"`);
    // Вложенные заголовки внутри правила не трогаем.
    expect(html).toContain("Второй заголовок");
    expect(html).toContain("Вы используете поток магии земли.");
  });

  it("сохраняет заголовок, если он не повторяет имя сущности", () => {
    const entity: RuleEntity = {
      id: "feature:test",
      kind: "feature",
      name: "Тестовая особенность",
      markdown: "##### Подзаголовок\n\nТекст правила.",
      source: { articleId: "0801", path: "content/rules/entities/feature/test.json" },
      legacyIds: [],
    };

    const html = renderEntity(entity);

    expect(html).toContain('id="подзаголовок"');
    expect(html).toContain("Подзаголовок");
    expect(html.match(/Тестовая особенность/g) ?? []).toHaveLength(1);
  });
});

describe("normalizeAbilityText: сравнимая форма текста", () => {
  it("схлопывает переносы и повторы пробелов", () => {
    expect(normalizeAbilityText("  Потрать 1\n\nЭссенцию:\n  текст ")).toBe(
      "Потрать 1 Эссенцию: текст",
    );
  });

  it("не склеивает слова на месте переноса строки", () => {
    expect(normalizeAbilityText("Потрать\n1")).toBe("Потрать 1");
  });

  it("сохраняет реальные различия текста", () => {
    expect(normalizeAbilityText("Потрать 1")).not.toBe(
      normalizeAbilityText("Потрать 2"),
    );
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
    const reference = renderEntity(abilityEntity());

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
