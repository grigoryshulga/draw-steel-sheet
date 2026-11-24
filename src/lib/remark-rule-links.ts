import type { Root, Nodes, Parents, PhrasingContent } from "mdast";
import { READING_CATALOG as CATALOG, READING_GLOSSARY as GLOSSARY } from "../rules/consumer-reading";
import { catalogEntryLink, glossaryLink } from "./library-utils";
import { codexIndex } from "../rules/codex-navigation";
import { searchText } from "./codex";

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
for (const entry of codexIndex) register(entry.title, `#/codex/${entry.id}`);
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
const englishTerms = new Map<string, string>();
for (const term of GLOSSARY) {
  const name = searchText(term.english.trim());
  if (name.length >= 4) englishTerms.set(name, glossaryLink(term.id));
}

function wordPattern(names: Iterable<string>) {
  return new RegExp(
    `(?<![\\p{L}\\p{N}])(${[...names]
      .sort((a, b) => b.length - a.length)
      .map((word) =>
        word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/е/g, "[её]"),
      )
      .join("|")})(?![\\p{L}\\p{N}])`,
    "giu",
  );
}
const russianPattern = wordPattern(destinations.keys());
const englishPattern = wordPattern(englishTerms.keys());

/** Resolve links in the pinned SCC edition while the local routing index loads. */
export function sourceRuleHref(url: string, targets?: Record<string, string>): string | undefined {
  const match = /^scc\.v1:mcdm\.(heroes|monsters|summoner)\.v1\/([a-z0-9-]+(?:[./][a-z0-9-]+)*)$/.exec(url);
  if (!match) return;
  if (targets?.[url]) return targets[url];
  const path = match[2].replaceAll(".", "/");
  const term = path.split("/").at(-1)!.replaceAll("-", " ");
  return englishTerms.get(term) ?? `https://github.com/SteelCompendium/data-unified/blob/bdb12093b1d07bf8674453796eac907a09dd7dd3/en/books/${match[1]}/md-linked/${path}.md`;
}

/** Keep authored links and link the first mention of each unambiguous rule term. */
export function remarkRuleLinks(options?: { english?: boolean; targets?: Record<string, string> }) {
  const pattern = options?.english ? englishPattern : russianPattern;
  const links = options?.english ? englishTerms : destinations;
  return (tree: Root) => {
    const seen = new Set<string>();
    function visit(node: Nodes) {
      if (options?.english && node.type === "link") {
        node.url = sourceRuleHref(node.url, options.targets) ?? node.url;
        return;
      }
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
          const href = links.get(searchText(match[0]));
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
