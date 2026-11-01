import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Chip, Modal } from "../../components/ui";
import { HelpTooltip } from "../../components/HelpTooltip";
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
          {item.notes && (
            <div className="sheet-ability-card-tags">
              <HelpTooltip label={`Примечание: ${item.name}`}>
                <div className="rich-text"><ReactMarkdown remarkPlugins={[remarkGfm]}>{item.notes}</ReactMarkdown></div>
              </HelpTooltip>
            </div>
          )}
        </header>

        {showSummary && <div className="sheet-passive-summary sheet-passive-markdown"><ReactMarkdown remarkPlugins={[remarkGfm]}>{item.summary}</ReactMarkdown></div>}
        {description && (
          <div className="sheet-passive-preview sheet-passive-markdown"><ReactMarkdown remarkPlugins={[remarkGfm]}>{description}</ReactMarkdown></div>
        )}

      </article>
      <Modal open={open} onClose={() => setOpen(false)} title={item.name}>
        <div className="sheet-passive-full">
          <div className="hstack wrap">
            <Chip tone={item.category === "subclass" ? "blue" : "default"}>
              {FEATURE_CATEGORY_LABELS[item.category]}
            </Chip>
            <span className="sheet-passive-level mono">{item.level} ур.</span>
          </div>
          {showSummary && <div className="sheet-passive-summary sheet-passive-markdown"><ReactMarkdown remarkPlugins={[remarkGfm]}>{item.summary}</ReactMarkdown></div>}
          {description && <div className="sheet-passive-markdown"><ReactMarkdown remarkPlugins={[remarkGfm]}>{description}</ReactMarkdown></div>}
        </div>
      </Modal>
    </>
  );
}
