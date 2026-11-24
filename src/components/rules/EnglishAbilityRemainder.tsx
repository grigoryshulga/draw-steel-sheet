import { AbilityTiers } from "./AbilitySheet";
import { printedTiers } from "./printedAbilityView";
import { RuleMarkdown } from "./RuleMarkdown";
import type { PrintedBlock } from "../../rules/printed-ability";

export function EnglishAbilityRemainder({ blocks, articleId }: { blocks: PrintedBlock[]; articleId?: string }) {
  const markdown = (text: string) => <RuleMarkdown sourceLocale="en" text={text} articleId={articleId} />;
  return <>{blocks.map((block, index) => "text" in block
    ? <RuleMarkdown key={index} sourceLocale="en" text={block.text} articleId={articleId} />
    : <section key={index} className="rule-ability-extra-roll">
        <p>{block.roll.title}</p>
        <AbilityTiers language="en" tiers={printedTiers(block.roll, undefined, markdown)} />
      </section>)}</>;
}
