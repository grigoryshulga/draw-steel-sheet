import type {
  Root,
  Blockquote,
  List,
  Paragraph,
  PhrasingContent,
  RootContent,
  Table,
} from "mdast";

function text(node: {
  type: string;
  value?: string;
  children?: unknown[];
}): string {
  return (
    node.value ??
    (node.children ?? [])
      .map((child) => text(child as Parameters<typeof text>[0]))
      .join("")
  );
}
function paragraph(children: PhrasingContent[], className: string): Paragraph {
  return {
    type: "paragraph",
    children,
    data: { hName: "div", hProperties: { className: className.split(" ") } },
  };
}
function literal(value: string): PhrasingContent {
  return { type: "text", value };
}
function group(
  children: Blockquote["children"],
  className: string,
): Blockquote {
  return {
    type: "blockquote",
    children,
    data: { hName: "div", hProperties: { className: className.split(" ") } },
  };
}
function fact(label: string, children: PhrasingContent[]): Paragraph {
  return paragraph(
    [
      {
        type: "strong",
        children: [literal(label)],
        data: {
          hName: "span",
          hProperties: { className: ["abil-fact-label"] },
        },
      },
      {
        type: "strong",
        children,
        data: {
          hName: "span",
          hProperties: { className: ["abil-fact-value"] },
        },
      },
    ],
    "abil-fact",
  );
}

/** Части исходной цитаты, из которых собирается карточка способности. */
interface AbilityQuote {
  node: Blockquote;
  title: Paragraph;
  table: Table;
}

/**
 * Распознать цитату способности в источнике: заголовок-paragraph из одного
 * strong и таблица 2×2 с 📏 и 🎯. Обычные врезки правил не подходят и
 * остаются нетронутыми.
 */
function abilityQuote(node: RootContent): AbilityQuote | null {
  if (node.type !== "blockquote") return null;
  const title = node.children[0];
  const table = node.children.find(
    (child): child is Table => child.type === "table",
  );
  if (
    title?.type !== "paragraph" ||
    title.children.length !== 1 ||
    (title.children[0].type !== "strong" &&
      !/^\*\*.+\*\*$/.test(text(title))) ||
    !table ||
    table.children.length !== 2 ||
    table.children.some((row) => row.children.length !== 2) ||
    !text(table.children[1].children[0]).includes("📏") ||
    !text(table.children[1].children[1]).includes("🎯")
  )
    return null;
  return { node, title, table };
}

/** Метки диапазонов тиров в источнике: «≤11:», «12-16:», «17+:». */
const TIER_LABELS = [
  /^(≤\s*11|11 или меньше):/,
  /^12\s*[-–]\s*16:/,
  /^(17\+|17 и выше):/,
];

function isTierList(node: RootContent): node is List {
  return (
    node.type === "list" &&
    node.children.length === 3 &&
    node.children.every((item, index) => TIER_LABELS[index].test(text(item)))
  );
}

function leadingLabel(node: RootContent): string {
  if (node.type !== "paragraph") return "";
  return text(node.children[0] ?? literal(""));
}

/**
 * Части цитаты, которые показывает карточка способности: заголовок, таблица
 * фактов, флейвор, бросок силы, тиры и абзацы «Эффект»/«Триггер».
 */
function isCardPart(node: RootContent, quote: AbilityQuote): boolean {
  if (node === quote.title || node === quote.table) return true;
  if (
    node.type === "paragraph" &&
    node.children.length === 1 &&
    node.children[0].type === "emphasis"
  )
    return true;
  if (isTierList(node)) return true;
  const label = leadingLabel(node);
  return /^Бросок силы/i.test(label) || /^(Эффект|Триггер)\s*:/i.test(label);
}

/** Recognize only the source's ability schema; leave ordinary callouts untouched.
 * Transform presentation nodes, never replace rules with the lossy catalog snapshot.
 */
export function remarkAbilityBlocks() {
  return (tree: Root) => {
    function visit(nodes: RootContent[]) {
      for (const node of nodes) {
        if (node.type !== "blockquote") continue;
        const quote = abilityQuote(node);
        if (!quote) {
          visit(node.children);
          continue;
        }
        const { title, table } = quote;
        const [header, values] = table.children;
        const keywords = text(header.children[0])
          .split(",")
          .map((keyword) => keyword.trim())
          .filter(Boolean);
        const chips = paragraph(
          keywords.map((keyword) => ({
            type: "strong",
            children: [literal(keyword)],
            data: {
              hName: "span",
              hProperties: {
                className: ["chip", "chip-static", "chip-default"],
              },
            },
          })),
          "abil-keywords",
        );
        const facts = group(
          [
            fact("Действие", header.children[1].children),
            fact("Дистанция", values.children[0].children),
            fact("Цель", values.children[1].children),
          ],
          "abil-facts",
        );
        node.data = {
          hName: "section",
          hProperties: { className: ["codex-ability"] },
        };
        node.children = node.children.flatMap((child) => {
          if (child === title)
            return [
              paragraph(
                title.children[0].type === "strong"
                  ? title.children[0].children
                  : [
                      literal(
                        text(title)
                          .replace(/^\*\*|\*\*$/g, "")
                          .trim(),
                      ),
                    ],
                "codex-ability-title",
              ),
            ];
          if (child === table) return [chips, facts];
          if (
            child.type === "paragraph" &&
            child.children.length === 1 &&
            child.children[0].type === "emphasis"
          ) {
            child.data = { hProperties: { className: ["abil-flavor"] } };
          } else if (isTierList(child)) {
            child.data = {
              hName: "div",
              hProperties: { className: ["abil-tiers"] },
            };
            child.children.forEach((item, i) => {
              item.data = {
                hName: "div",
                hProperties: {
                  className: ["abil-tier"],
                  "data-tier": String(i + 1),
                },
              };
            });
          } else if (child.type === "paragraph") {
            const label = text(child.children[0] ?? literal(""));
            if (/^(Эффект|Триггер|Особое|Потратить|Усиление)/i.test(label)) {
              child.data = {
                hProperties: {
                  className: /^Триггер/i.test(label)
                    ? ["abil-block", "abil-block-trigger"]
                    : ["abil-block"],
                },
              };
            } else if (/^Бросок силы/i.test(label)) {
              child.data = {
                hProperties: { className: ["codex-ability-roll"] },
              };
            }
          }
          return [child];
        });
      }
    }
    visit(tree.children);
  };
}

/**
 * Сравнимая форма текста: пробельные последовательности (в том числе `\n\n`
 * между абзацами) схлопываются в один пробел, края обрезаются. Markdown-разметка
 * сюда не попадает — она снимается при сборе plain-текста узла.
 */
export function normalizeAbilityText(value: string): string {
  return value.replace(/\s+/gu, " ").trim();
}

/** Plain-текст узла mdast без markdown-синтаксиса: эмфазис и ссылки дают текст. */
function plainText(node: RootContent): string {
  return normalizeAbilityText(text(node));
}

/**
 * Узел уже показан карточкой: его plain-текст дословно входит в показанный
 * текст. Пустой текст не считается покрытым — иначе совпадение было бы
 * случайным.
 */
function isAlreadyShown(node: RootContent, shown: string): boolean {
  const plain = plainText(node);
  return plain.length > 0 && shown.includes(plain);
}

/** Параметры отбора «допблоков». */
export interface AbilityCardRemainderOptions {
  /** Текст, который карточка способности уже показывает (её `effect`). */
  shownText?: string;
}

/**
 * Оставить от цитаты-карточки только «допблоки» — то, чего в структурной
 * проекции нет.
 *
 * Карточка способности уже показывает факты, метки, тиры и текст эффекта с
 * триггером, поэтому её части (заголовок, таблица 📏/🎯, флейвор, бросок силы,
 * тиры, абзацы «Эффект» и «Триггер») из источника убираются. Оставшиеся дети
 * — «Поддержание», «Потратить», «Особое», «Возбужденность», списки и проза —
 * разворачиваются в поток статьи без обёртки цитаты.
 *
 * Если передан `shownText`, из остатка убирается и то, что дословно повторяет
 * уже показанный текст: импортёр склеивает допблоки в `effect`, и без этого
 * сравнения они дублировались бы под карточкой. Пункты списков сравниваются
 * по отдельности; таблицы, цитаты и прочие узлы не трогаются. Markdown без
 * распознанной ability-цитаты не меняется вовсе.
 */
export function remarkAbilityCardRemainder(
  options: AbilityCardRemainderOptions = {},
) {
  const shown = options.shownText
    ? normalizeAbilityText(options.shownText)
    : "";

  function keep(child: RootContent): RootContent[] {
    if (!shown) return [child];
    if (child.type === "paragraph")
      return isAlreadyShown(child, shown) ? [] : [child];
    if (child.type === "list") {
      const items = child.children.filter(
        (item) => !isAlreadyShown(item, shown),
      );
      if (items.length === 0) return [];
      if (items.length === child.children.length) return [child];
      return [{ ...child, children: items }];
    }
    return [child];
  }

  return (tree: Root) => {
    const remainder: RootContent[] = [];
    for (const node of tree.children) {
      const quote = abilityQuote(node);
      if (!quote) {
        remainder.push(node);
        continue;
      }
      for (const child of quote.node.children) {
        if (isCardPart(child, quote)) continue;
        remainder.push(...keep(child));
      }
    }
    tree.children = remainder;
  };
}
