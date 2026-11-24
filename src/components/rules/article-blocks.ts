import type { RuleArticle, RuleBlock, RuleEntity } from "../../rules/schema";

interface ReadingBlock {
  block: RuleBlock;
  russianText?: string;
}

/** The reader and both tables of contents must consume the same ordered edition. */
export function articleBlocks(article: RuleArticle, entities: Record<string, RuleEntity>, english: boolean): ReadingBlock[] {
  if (!english) return article.blocks.map(block => ({ block }));
  if (article.englishEdition) return article.englishEdition.blocks.map(block => ({ block }));
  const lead = article.blocks.findIndex(block => block.type === "markdown" ? Boolean(block.text.trim()) : Boolean(entities[block.ref]));
  const original = article.originalDescription?.trim();
  const distinct = original && !Object.values(entities).some(entity => entity.originalDescription?.trim() === original);
  const result: ReadingBlock[] = [];
  if (distinct && (lead < 0 || article.blocks[lead].type === "entity")) result.push({ block: { type: "markdown", text: original } });
  for (const [index, block] of article.blocks.entries()) {
    const text = block.type === "markdown" && (block.originalText || (index === lead && distinct && original));
    result.push(text && block.type === "markdown"
      ? { block: { type: "markdown", text }, russianText: block.text }
      : { block });
  }
  return result;
}
