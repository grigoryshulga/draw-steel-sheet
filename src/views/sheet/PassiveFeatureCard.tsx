import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Card, CardHeader, CardTitle, Chip } from "../../components/ui";
import { CardDetailModal } from "../../components/CardDetailModal";
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
      <Card
        className="sheet-ability-card sheet-passive-card"
        data-category={item.category}
      >
        <CardHeader className="sheet-ability-card-head card-band">
          <CardTitle
            as="h4"
            title={item.name}
            onOpen={() => setOpen(true)}
            openLabel={`Открыть особенность: ${item.name}`}
          >
            {item.name}
          </CardTitle>
          {(item.notes || item.category === "ancestry") && (
            <div className="sheet-ability-card-tags">
              {item.category === "ancestry" && <Chip title={item.source}>Знаковая черта</Chip>}
              {item.notes && <HelpTooltip label={`Примечание: ${item.name}`}>
                <div className="rich-text"><ReactMarkdown remarkPlugins={[remarkGfm]}>{item.notes}</ReactMarkdown></div>
              </HelpTooltip>}
            </div>
          )}
        </CardHeader>

        {showSummary && <div className="sheet-passive-summary sheet-passive-markdown"><ReactMarkdown remarkPlugins={[remarkGfm]}>{item.summary}</ReactMarkdown></div>}
        {description && (
          <div className="sheet-passive-preview sheet-passive-markdown"><ReactMarkdown remarkPlugins={[remarkGfm]}>{description}</ReactMarkdown></div>
        )}

      </Card>
      <CardDetailModal
        open={open}
        onClose={() => setOpen(false)}
        title={item.name}
        source={item.source ?? `${item.level} ур.`}
        meta={
          <Chip tone={item.category === "subclass" ? "blue" : "default"}>
            {FEATURE_CATEGORY_LABELS[item.category]}
          </Chip>
        }
        autoHeight
      >
        <div className="sheet-passive-full">
          {showSummary && <div className="sheet-passive-summary sheet-passive-markdown"><ReactMarkdown remarkPlugins={[remarkGfm]}>{item.summary}</ReactMarkdown></div>}
          {description && <div className="sheet-passive-markdown"><ReactMarkdown remarkPlugins={[remarkGfm]}>{description}</ReactMarkdown></div>}
        </div>
      </CardDetailModal>
    </>
  );
}
