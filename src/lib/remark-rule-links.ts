import type { Root, Nodes, Parents, PhrasingContent } from "mdast";
import {
  CATALOG,
  GLOSSARY,
  catalogEntryLink,
  glossaryLink,
} from "../data/library";
import { CODEX_INDEX, searchText } from "./codex";

const destinations = new Map<string, string>();
const ambiguous = new Set<string>();
function register(name: string, href: string) {
  const key = searchText(name.trim());
  if (key.length < 4 || ambiguous.has(key)) return;
  if (destinations.has(key) && destinations.get(key) !== href) {
    destinations.delete(key);
    ambiguous.add(key);
  } else destinations.set(key, href);
}
for (const entry of CODEX_INDEX) register(entry.title, `#/codex/${entry.id}`);
const catalogNames = new Set(CATALOG.map((entry) => searchText(entry.name)));
for (const name of catalogNames) {
  destinations.delete(name);
  ambiguous.delete(name);
}
for (const entry of CATALOG) register(entry.name, catalogEntryLink(entry));
// A short definition is the preferred destination for a rule term.
for (const term of GLOSSARY) {
  const key = searchText(term.name);
  if (key.length >= 4) {
    destinations.set(key, glossaryLink(term.id));
    ambiguous.delete(key);
  }
}
const pattern = new RegExp(
  `(?<![\\p{L}\\p{N}])(${[...destinations.keys()]
    .sort((a, b) => b.length - a.length)
    .map((word) =>
      word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/е/g, "[её]"),
    )
    .join("|")})(?![\\p{L}\\p{N}])`,
  "giu",
);

/** Exact, unambiguous names only; keep authored links and link each destination once. */
export function remarkRuleLinks() {
  return (tree: Root) => {
    const seen = new Set<string>();
    function visit(node: Nodes) {
      if (
        [
          "link",
          "linkReference",
          "heading",
          "code",
          "inlineCode",
          "image",
          "html",
        ].includes(node.type)
      )
        return;
      const classes = node.data?.hProperties?.className || [];
      if (
        classes.some((c) =>
          ["codex-ability-title", "abil-fact-label", "abil-keywords"].includes(
            c,
          ),
        )
      )
        return;
      if (
        node.type === "strong" &&
        node.children.every((child) => child.type === "text") &&
        /:$/.test(
          node.children
            .map((child) => ("value" in child ? child.value : ""))
            .join(""),
        )
      )
        return;
      if (!("children" in node)) return;
      const parent = node as Parents;
      const children: Nodes[] = [];
      for (const child of parent.children) {
        if (child.type !== "text") {
          visit(child);
          children.push(child);
          continue;
        }
        let cursor = 0;
        for (const match of child.value.matchAll(pattern)) {
          const href = destinations.get(searchText(match[0]));
          if (!href || seen.has(href)) continue;
          if (match.index! > cursor)
            children.push({
              type: "text",
              value: child.value.slice(cursor, match.index),
            });
          children.push({
            type: "link",
            url: href,
            children: [{ type: "text", value: match[0] }],
            data: { hProperties: { className: ["rule-reference"] } },
          });
          cursor = match.index! + match[0].length;
          seen.add(href);
        }
        if (cursor < child.value.length)
          children.push({ type: "text", value: child.value.slice(cursor) });
      }
      // Text nodes occur only in phrasing parents; other child types are retained.
      parent.children = children as PhrasingContent[] & typeof parent.children;
    }
    visit(tree);
  };
}
