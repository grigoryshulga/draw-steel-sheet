import { useState } from "react";
import { Chip, Modal } from "../../components/ui";
import { HelpTooltip } from "../../components/HelpTooltip";
import { RichText } from "../../components/RichText";
import {
  FEATURE_CATEGORY_LABELS,
  type FeatureSheetItem,
} from "../../lib/class-feature-view";

/** Пассивная особенность с кратким текстом и полным описанием по заголовку. */
export function PassiveFeatureCard({ item }: { item: FeatureSheetItem }) {
  const [open, setOpen] = useState(false);
  const description = item.detail || item.summary;
  const showSummary = Boolean(
    item.detail && item.summary && !item.summaryFromDescription && item.summary !== item.detail,
  );

  return (
    <>
      <article
        className="sheet-ability-card sheet-passive-card"
        data-category={item.category}
      >
        <header className="sheet-ability-card-head">
          <h4 title={item.name}>
            <button
              type="button"
              className="sheet-ability-title"
              aria-label={`Открыть особенность: ${item.name}`}
              onClick={() => setOpen(true)}
            >
              {item.name}
            </button>
          </h4>
          <div className="sheet-ability-card-tags">
            {item.notes && (
              <HelpTooltip label={`Примечание: ${item.name}`}>
                <RichText text={item.notes} characteristicGlyphs />
              </HelpTooltip>
            )}
            <Chip tone={item.category === "subclass" ? "blue" : "default"}>
              {FEATURE_CATEGORY_LABELS[item.category]}
            </Chip>
            <span className="sheet-passive-level mono">{item.level} ур.</span>
          </div>
        </header>

        {showSummary && <p className="sheet-passive-summary">{item.summary}</p>}
        {description && (
          <RichText text={description} className="sheet-passive-preview" characteristicGlyphs />
        )}

        <footer className="sheet-ability-footer">
          <span><em>Пассивно</em> не требует действия</span>
        </footer>
      </article>
      <Modal open={open} onClose={() => setOpen(false)} title={item.name}>
        <div className="sheet-passive-full">
          {showSummary && <p className="sheet-passive-summary">{item.summary}</p>}
          {description && <RichText text={description} characteristicGlyphs />}
        </div>
      </Modal>
    </>
  );
}
