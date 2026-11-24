import type { RuleEntity } from "./schema";

function section(text: string, name: string, family: string[]) {
  const headings = [...text.matchAll(/^## (.+)$/gm)].filter(heading => family.includes(heading[1].trim()));
  const index = headings.findIndex(heading => heading[1].trim() === name);
  if (index < 0) return;
  const clean = (value: string) => value.replace(/\n---\s*$/, "").trim();
  return {
    common: clean(text.slice(0, headings[0].index)),
    own: clean(text.slice(headings[index].index + headings[index][0].length, headings[index + 1]?.index)),
  };
}

/** The source's section headings are keyed by the four stable Stormwight kit IDs. */
export function englishKitVariantName(kit: { id: string }) {
  const slug = kit.id.split(".").at(-1)!;
  return slug.charAt(0).toUpperCase() + slug.slice(1);
}

export function kitVariantEntity(entity: RuleEntity, name: string): RuleEntity | undefined {
  if (entity.kind !== "kit" || !entity.kitVariants) return;
  const variant = entity.kitVariants.find(item => item.name === name);
  if (!variant) return;
  const russian = section(entity.markdown, name, entity.kitVariants.map(item => item.name));
  if (!russian) return;
  const originalName = englishKitVariantName(variant);
  const english = section(entity.originalDescription ?? "", originalName, entity.kitVariants.map(englishKitVariantName));
  const originalDescription = english && `${english.own}\n\n## Shared Stormwight Features\n\n${english.common}`;
  const englishSignatures = entity.englishSignatures?.flatMap(signature => {
    if (signature.ref !== variant.signatureAbilityId || !originalDescription) return [];
    const passage = entity.originalDescription!.slice(signature.start, signature.end);
    const start = originalDescription.indexOf(passage);
    return start < 0 ? [] : [{ ref: signature.ref, start, end: start + passage.length }];
  });
  return {
    ...entity,
    id: variant.id,
    name: variant.name,
    originalName,
    originalDescription,
    englishSignatures,
    kitVariants: undefined,
    markdown: `${russian.own}\n\n### Общие особенности буревестника\n\n${russian.common}`,
  };
}
