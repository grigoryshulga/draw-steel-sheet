import { kitBonusLabel } from "../../data/kits";
import { RuleMarkdown } from "./RuleMarkdown";
import "./KitRuleBody.css";

/** Оформляет группы бонусов, сохраняя окружающий канонический текст. */
export function KitRuleBody({ text, articleId, headingOffset }: {
  text: string;
  articleId: string;
  headingOffset: number;
}) {
  // Stormwight uses list items; standard kits use plain paragraphs. Normalize
  // just these labels so every adjacent bonus shares the same compact grid.
  const normalized = text.replace(/^[ \t]*[-*] (?=\*\*Бонус к )/gm, "");
  const groups = normalized.split(/((?:\*\*Бонус к [^\n]+\*\*[^\n]*(?:\n\s*)?)+)/g);
  return <>{groups.map((part, index) => {
    const bonuses = [...part.matchAll(/^\*\*Бонус к (.+?):\*\*\s*(.+)$/gm)];
    if (!bonuses.length) return <RuleMarkdown key={index} text={part} articleId={articleId} headingOffset={headingOffset} />;
    return <dl className="kit-rule-bonuses" key={index}>
      {bonuses.map(([, label, value]) => {
        const tiers = /^([+]\d+)\/([+]\d+)\/([+]\d+)$/.exec(value.trim());
        return <div className="kit-rule-bonus" key={label}>
          <dt>{kitBonusLabel(label)}</dt>
          <dd>{tiers ? <div className="kit-rule-tiers">
            {tiers.slice(1).map((bonus, tier) => <div key={tier}>
              <span>{["≤11", "12–16", "17+"][tier]}</span><strong>{bonus}</strong>
            </div>)}
          </div> : <RuleMarkdown text={value} articleId={articleId} />}</dd>
        </div>;
      })}
    </dl>;
  })}</>;
}
