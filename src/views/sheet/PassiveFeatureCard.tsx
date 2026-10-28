import { Chip } from "../../components/ui";
import { RichText } from "../../components/RichText";
import {
  FEATURE_CATEGORY_LABELS,
  type FeatureSheetItem,
} from "../../lib/class-feature-view";

/**
 * Пассивная особенность класса в панели способностей: тот же визуальный язык,
 * что у карточки способности, но без броска и кнопки «Использовать».
 */
export function PassiveFeatureCard({ item }: { item: FeatureSheetItem }) {
  return (
    <article
      className="sheet-ability-card sheet-passive-card"
      data-category={item.category}
    >
      <header className="sheet-ability-card-head">
        <h4>{item.name}</h4>
        <div className="sheet-ability-card-tags">
          <Chip tone={item.category === "subclass" ? "blue" : "default"}>
            {FEATURE_CATEGORY_LABELS[item.category]}
          </Chip>
          <span className="sheet-passive-level mono">{item.level} ур.</span>
        </div>
      </header>

      {item.summary && <p className="sheet-ability-body">{item.summary}</p>}

      {item.notes && (
        <details className="sheet-passive-details">
          <summary>Примечание</summary>
          <RichText text={item.notes} />
        </details>
      )}

      {item.detail && (
        <details className="sheet-passive-details">
          <summary>Текст особенности</summary>
          <RichText text={item.detail} />
        </details>
      )}

      <footer className="sheet-ability-footer">
        <span>
          <em>Пассивно</em> не требует действия
        </span>
      </footer>
    </article>
  );
}
