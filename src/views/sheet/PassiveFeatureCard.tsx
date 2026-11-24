import { useLocale, useRuleLanguage } from "../../i18n/locale";
import { ArticleLanguageSwitch } from "../../components/LanguageSwitch";
import { useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Card, CardHeader, CardTitle, Chip } from "../../components/ui";
import { CardDetailModal } from "../../components/CardDetailModal";
import { HelpTooltip } from "../../components/HelpTooltip";
import { useAbilityCatalog } from "../../components/abilityOriginal";
import { CLASS_FEATURE_SYNTHETIC_ROWS } from "../../data/class-features/legacy-rows";
import { canonicalClassFeatureId } from "../../data/originals";
import {
  FEATURE_CATEGORY_LABELS,
  type FeatureSheetItem,
} from "../../lib/class-feature-view";

/** Пассивная особенность с кратким текстом и полным описанием по заголовку. */
export function PassiveFeatureCard({ item, action }: { item: FeatureSheetItem; action?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { t, locale } = useLocale();
  const synthetic = !item.originalDescription && item.id.startsWith("feature.ability.")
    ? CLASS_FEATURE_SYNTHETIC_ROWS.find(row => canonicalClassFeatureId(row.id) === item.id && row.name === item.name && row.description === item.detail)
    : undefined;
  const catalog = useAbilityCatalog((locale === "en" || open) && !!synthetic);
  const original = synthetic ? catalog.find(ability => ability.id === synthetic.id) : undefined;
  const originalDescription = item.originalDescription || original?.originalDescription;
  const originalName = item.originalName || original?.originalName;
  const { language, setLanguage, available } = useRuleLanguage(open ? item.id : "", originalDescription);
  const name = language === "en" && originalName ? originalName : item.name;
  const description = language === "en" ? originalDescription : item.detail || item.trigger?.detail || item.summary;
  const switcher = available && <ArticleLanguageSwitch language={language} setLanguage={setLanguage} />;
  const showSummary = Boolean(
    language === "ru" && item.detail && item.summary && !item.summaryFromDescription && item.summary !== item.detail,
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
            title={name}
            onOpen={() => setOpen(true)}
            openLabel={t(`Открыть особенность: ${name}`, `Open feature: ${name}`)}
          >
            {name}
          </CardTitle>
          {(item.notes || item.category === "ancestry") && (
            <div className="sheet-ability-card-tags">
              {item.category === "ancestry" && <Chip title={item.source}>{t("Знаковая черта", "Signature trait")}</Chip>}
              {item.notes && <HelpTooltip label={t(`Примечание: ${name}`, `Note: ${name}`)}>
                <div className="rich-text"><ReactMarkdown remarkPlugins={[remarkGfm]}>{item.notes}</ReactMarkdown></div>
              </HelpTooltip>}
            </div>
          )}
        </CardHeader>

        {locale === "en" && !available && <p className="muted small">Russian text only</p>}
        {showSummary && <div className="sheet-passive-summary sheet-passive-markdown"><ReactMarkdown remarkPlugins={[remarkGfm]}>{item.summary}</ReactMarkdown></div>}
        {description && (
          <div lang={language} className="sheet-passive-preview sheet-passive-markdown"><ReactMarkdown remarkPlugins={[remarkGfm]}>{description}</ReactMarkdown></div>
        )}

      </Card>
      <CardDetailModal
        open={open}
        onClose={() => setOpen(false)}
        title={name}
        headerActions={switcher}
        source={item.source ?? t(`${item.level} ур.`, `Level ${item.level}`)}
        meta={
          <Chip tone={item.category === "subclass" ? "blue" : "default"}>
            {t(FEATURE_CATEGORY_LABELS[item.category], { ancestry: "Ancestry", class: "Class", subclass: "Subclass", resource: "Resource", choice: "Choice", trigger: "Trigger" }[item.category])}
          </Chip>
        }
        autoHeight
        footer={action}
      >
        <div lang={language} className="sheet-passive-full">
          {showSummary && <div className="sheet-passive-summary sheet-passive-markdown"><ReactMarkdown remarkPlugins={[remarkGfm]}>{item.summary}</ReactMarkdown></div>}
          {description && <div className="sheet-passive-markdown"><ReactMarkdown remarkPlugins={[remarkGfm]}>{description}</ReactMarkdown></div>}
        </div>
      </CardDetailModal>
    </>
  );
}
