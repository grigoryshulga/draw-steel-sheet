import { articleBlocks } from "./article-blocks";
import { headingId } from "../../lib/codex";
import type { RuleArticle, RuleEntity, RuleIndexEntry } from "../../rules/schema";
import { ruleEntityAnchor, stripRepeatedEntityHeading } from "./RuleEntity";

type Heading = RuleIndexEntry["headings"][number];
const plainHeading = (value: string) => value
  .replace(/<[^>]*>/g, "")
  .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
  .replace(/[*_`]/g, "").trim();
function markdownHeadings(text: string): Heading[] {
  const headings: Heading[] = [];
  let inFence = false;
  for (const line of text.split("\n")) {
    if (/^\s*(```|~~~)/.test(line)) { inFence = !inFence; continue; }
    if (inFence) continue;
    const match = /^(#{1,6})[ \t]+(.+?)[ \t]*#*[ \t]*$/.exec(line);
    if (!match) continue;
    const title = plainHeading(match[2]);
    if (title) headings.push({ id: headingId(title), title, level: Math.max(2, match[1].length) });
  }
  return headings;
}

/** TOC for the actual displayed English article, retaining Russian-only fallback blocks. */
export function englishArticleHeadings(article: RuleArticle, entities: Record<string, RuleEntity>): Heading[] {
  const result: Heading[] = [];
  const isCreature = article.director?.section === "monsters" && article.director.recordType === "statblock";
  articleBlocks(article, entities, true).forEach(({ block }) => {
    if (block.type === "markdown") {
      if (!isCreature) result.push(...markdownHeadings(block.text));
      return;
    }
    const entity = entities[block.ref];
    if (!entity) return;
    const original = entity.englishEdition?.text || entity.originalDescription?.trim();
    const title = original ? entity.englishEdition?.name || entity.originalName || entity.name : entity.name;
    result.push({ id: ruleEntityAnchor(entity), title, level: article.chapter.startsWith("04.") && entity.kind === "feature" ? 3 : 2 });
    const text = original ? stripRepeatedEntityHeading(original, title).markdown : stripRepeatedEntityHeading(entity.markdown, entity.name).markdown;
    result.push(...markdownHeadings(text));
  });
  return result;
}
