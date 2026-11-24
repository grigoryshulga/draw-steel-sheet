import type { ReactNode } from "react";
import { useLocale, useRuleLanguage } from "../i18n/locale";
import { lazy, Suspense } from "react";
const RuleText = lazy(() => import("./RuleText").then((module) => ({ default: module.RuleText })));
import { PERK_TYPE_META } from "../data/perks";
import type { PerkType } from "../types";
import { Card, CardHeader, CardTitle, Chip } from "./ui";
import "./PerkCard.css";

export interface PerkCardProps {
  /** Надпись над названием: слот, источник или «Перк». */
  eyebrow?: ReactNode;
  name: string;
  type?: PerkType | null;
  summary?: string;
  ruleId?: string;
  originalDescription?: string;
  originalName?: string;
  /** Карточка участвует в выборе: клик выбирает её. */
  onSelect?: () => void;
  selected?: boolean;
  /** Заголовок открывает полное описание в поп-апе. */
  onOpen?: () => void;
  /** Действия внизу карточки: выбор, изменение, удаление. */
  footerAction?: ReactNode;
  /** Цветная полоса шапки вокруг имени, как у карточки способности. */
  banded?: boolean;
  className?: string;
}

/**
 * Карточка перка — один вид и на листе, и в «Развитии».
 * Плоская рамка с верхней линией, название, краткое описание и действия.
 */
export function PerkCard({
  eyebrow,
  name,
  type,
  summary,
  ruleId,
  originalDescription,
  originalName,
  onSelect,
  selected = false,
  onOpen,
  footerAction,
  banded = false,
  className = "",
}: PerkCardProps) {
  const { t, locale } = useLocale();
  const meta = type ? PERK_TYPE_META[type] : null;
  const { language, available } = useRuleLanguage(ruleId || name, originalDescription);
  const displayName = language === "en" ? originalName || name : name;
  return (
    <Card
      className={`sheet-perk-card is-filled${banded ? " is-banded" : ""}${className ? ` ${className}` : ""}`}
      data-selected={selected || undefined}
      data-type={type ?? undefined}
      selected={selected}
      onSelect={onSelect}
      onOpen={onOpen}
    >
      <CardHeader className="sheet-perk-head" eyebrow={eyebrow} reserveSpace>
        {meta && <Chip tone={meta.tone}>{locale === "en" && type ? ({ crafting: "Crafting", exploration: "Exploration", interpersonal: "Interpersonal", intrigue: "Intrigue", lore: "Lore", supernatural: "Supernatural" } as const)[type] : meta.short}</Chip>}
      </CardHeader>
      <CardTitle
        as="h3"
        title={displayName}
        className={banded ? "card-band" : undefined}
        onOpen={onOpen}
        openLabel={t(`Открыть перк: ${name}`, `Open perk: ${displayName}`)}
      >
        {displayName}
      </CardTitle>
      {language === "en" && available ? <Suspense fallback={null}><RuleText text={originalDescription!} sourceLocale="en" /></Suspense> : summary && <p className="sheet-perk-summary">{summary}</p>}
      {footerAction && (
        <div
          className="sheet-perk-card-actions"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          {footerAction}
        </div>
      )}
    </Card>
  );
}
