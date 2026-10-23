import type {
  Root,
  Nodes,
  Parents,
  PhrasingContent,
  Paragraph,
  Blockquote,
} from "mdast";

/** Source metadata uses soft line breaks. Render each field as a separate row. */
export function remarkRuleFields() {
  return (tree: Root) => {
    function visit(node: Nodes) {
      if (!("children" in node)) return;
      const parent = node as Parents;
      parent.children = parent.children.map((child) => {
        if (child.type !== "paragraph") {
          visit(child);
          return child;
        }
        const rows: PhrasingContent[][] = [];
        for (const part of child.children) {
          const previous = rows.at(-1)?.at(-1);
          const isLabel =
            part.type === "strong" &&
            part.children.every((c) => c.type === "text") &&
            /:$/.test(
              part.children.map((c) => ("value" in c ? c.value : "")).join(""),
            );
          if (
            isLabel &&
            (!rows.length ||
              (previous?.type === "text" && /\n$/.test(previous.value)))
          )
            rows.push([]);
          if (!rows.length) return child;
          rows.at(-1)!.push(part);
        }
        if (rows.length < 2) return child;
        const fields: Blockquote = {
          type: "blockquote",
          data: { hName: "div", hProperties: { className: ["rule-fields"] } },
          children: rows.map((children): Paragraph => ({
            type: "paragraph",
            children,
            data: { hName: "div", hProperties: { className: ["rule-field"] } },
          })),
        };
        return fields;
      }) as typeof parent.children;
    }
    visit(tree);
  };
}
