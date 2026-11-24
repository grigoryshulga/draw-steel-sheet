import { kitBonusLabel } from "../../data/kit-bonuses";
import { RuleMarkdown } from "./RuleMarkdown";
import "./KitRuleBody.css";

/** Оформляет группы бонусов, сохраняя окружающий канонический текст. */
export function KitRuleBody({ text, articleId, headingOffset, sourceLocale = "ru" }: {
  text: string;
  articleId: string;
  headingOffset: number;
  sourceLocale?: "ru" | "en";
}) {
  // Only normalize known bonus labels. Other lists and paragraphs remain intact.
  const english = sourceLocale === "en";
  const normalized = text.replace(english
    ? /^[ \t]*[-*] (?=\*\*[^\n*]+ Bonus:\*\*)/gm
    : /^[ \t]*[-*] (?=\*\*Бонус к )/gm, "");
  const groups = normalized.split(english
    ? /((?:\*\*[^\n*]+ Bonus:\*\*[^\n]*(?:\n\s*)?)+)/g
    : /((?:\*\*Бонус к [^\n]+\*\*[^\n]*(?:\n\s*)?)+)/g);
  return <>{groups.map((part, index) => {
    const bonuses = [...part.matchAll(english
      ? /^\*\*(.+? Bonus):\*\*\s*(.+)$/gm
      : /^\*\*Бонус к (.+?):\*\*\s*(.+)$/gm)];
    if (!bonuses.length) return <RuleMarkdown key={index} text={part} articleId={articleId} headingOffset={headingOffset} sourceLocale={sourceLocale} sharedAbilityCards />;
    return <dl className="kit-rule-bonuses" key={index}>
      {bonuses.map(([, label, value], bonusIndex) => {
        const tiers = /^([+]\d+)\/([+]\d+)\/([+]\d+)\.?$/.exec(value.trim());
        return <div className="kit-rule-bonus" key={`${label}-${bonusIndex}`}>
          <dt>{english ? label : kitBonusLabel(label)}</dt>
          <dd>{tiers ? <div className="kit-rule-tiers">
            {tiers.slice(1).map((bonus, tier) => <div key={tier}>
              <span>{["≤11", "12–16", "17+"][tier]}</span><strong>{bonus}</strong>
            </div>)}
          </div> : <RuleMarkdown text={value} articleId={articleId} sourceLocale={sourceLocale} />}</dd>
        </div>;
      })}
    </dl>;
  })}</>;
}
