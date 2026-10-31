import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { LEVEL_UP_RULES } from "../../data/level-up-rules";
import { choiceValueLabel, levelUpChoiceGroupTitle } from "../../lib/level-up-history";
import type { Character } from "../../types";
import "./LevelUpHistory.css";

function RuleFeatures({
  rule,
  features = rule.features,
}: {
  rule: (typeof LEVEL_UP_RULES)[number];
  features?: (typeof LEVEL_UP_RULES)[number]["features"];
}) {
  if (features.length === 0) return null;
  return (
    <details className="level-up-rule-details">
      <summary>Правила и особенности уровня</summary>
      <div className="level-up-rule-content">
        {features.map((feature) => (
          <article className="level-up-feature" key={feature.id}>
            <h4>{feature.name}</h4>
            <div className="level-up-markdown">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{feature.description}</ReactMarkdown>
            </div>
          </article>
        ))}
        <a className="level-up-article-link" href={`#/codex/${rule.articleId}`}>
          Читать главу «{rule.title}»
        </a>
      </div>
    </details>
  );
}

/**
 * История повышений выводится из сохранённых записей, поэтому переживает
 * перезагрузку. Выборы уровня правятся во вкладке «Развитие», здесь только
 * след того, что уже произошло.
 */
export function LevelUpHistory({ character }: { character: Character }) {
  const records = [...(character.advancements ?? [])].reverse();
  if (records.length === 0) return null;
  return (
    <section className="level-up-history" aria-label="История повышений уровня">
      {records.map((record, index) => {
        const rule = LEVEL_UP_RULES.find((item) =>
          item.className === record.className && item.level === record.toLevel && item.articleId === record.articleId,
        );
        return (
          <details className="level-up-history-item" key={`${record.toLevel}:${record.createdAt}:${index}`}>
            <summary>Уровень {record.toLevel} · {record.className}</summary>
            {Object.entries(record.choices).length ? (
              <ul className="level-up-receipt-choices">
                {Object.entries(record.choices).map(([key, values]) => (
                  <li key={key}>
                    <strong>{levelUpChoiceGroupTitle(key, rule)}:</strong>{" "}
                    {values.map((value) => choiceValueLabel(key, value)).join(", ")}
                  </li>
                ))}
              </ul>
            ) : <p>Дополнительных выборов не было.</p>}
            <p><strong>Заметка:</strong> {record.notes || "не добавлена"}</p>
            {rule && <RuleFeatures rule={rule} />}
            <a className="level-up-article-link" href={`#/codex/${record.articleId}`}>
              Читать главу «{rule?.title ?? `уровень ${record.toLevel}`}»
            </a>
          </details>
        );
      })}
    </section>
  );
}
