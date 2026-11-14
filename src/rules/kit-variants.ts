import type { RuleEntity } from "./schema";

/** Полный текст одного варианта и общих правил из той же канонической сущности. */
export function kitVariantEntity(entity: RuleEntity, name: string): RuleEntity | undefined {
  if (entity.kind !== "kit") return undefined;
  const variant = entity.kitVariants?.find((item) => item.name === name);
  if (!variant) return undefined;
  const headings = [...entity.markdown.matchAll(/^## (.+)$/gm)];
  const index = headings.findIndex((heading) => heading[1].trim() === name);
  if (index < 0) return undefined;
  const common = entity.markdown.slice(0, headings[0].index).replace(/\n---\s*$/, "").trim();
  const own = entity.markdown
    .slice(headings[index].index + headings[index][0].length, headings[index + 1]?.index)
    .replace(/\n---\s*$/, "").trim();
  return {
    ...entity,
    id: variant.id,
    name: variant.name,
    kitVariants: undefined,
    markdown: `${own}\n\n### Общие особенности буревестника\n\n${common}`,
  };
}
