import type {
  Root,
  Blockquote,
  Paragraph,
  PhrasingContent,
  RootContent,
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

/** Recognize only the source's ability schema; leave ordinary callouts untouched.
 * Transform presentation nodes, never replace rules with the lossy catalog snapshot.
 */
export function remarkAbilityBlocks() {
  return (tree: Root) => {
    function visit(nodes: RootContent[]) {
      for (const node of nodes) {
        if (node.type !== "blockquote") continue;
        const title = node.children[0];
        const table = node.children.find((child) => child.type === "table");
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
        ) {
          visit(node.children);
          continue;
        }
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
          } else if (
            child.type === "list" &&
            child.children.length === 3 &&
            child.children.every((item, i) =>
              [
                /^(≤\s*11|11 или меньше):/,
                /^12\s*[-–]\s*16:/,
                /^(17\+|17 и выше):/,
              ][i].test(text(item)),
            )
          ) {
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
