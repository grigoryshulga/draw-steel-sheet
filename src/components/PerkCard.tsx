import type { ReactNode } from "react";
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
  onSelect,
  selected = false,
  onOpen,
  footerAction,
  banded = false,
  className = "",
}: PerkCardProps) {
  const meta = type ? PERK_TYPE_META[type] : null;
  return (
    <Card
      className={`sheet-perk-card is-filled${className ? ` ${className}` : ""}`}
      data-selected={selected || undefined}
      data-type={type ?? undefined}
      selected={selected}
      onSelect={onSelect}
      onOpen={onOpen}
    >
      <CardHeader className="sheet-perk-head" eyebrow={eyebrow} reserveSpace>
        {meta && <Chip tone={meta.tone}>{meta.short}</Chip>}
      </CardHeader>
      <CardTitle
        as="h3"
        className={banded ? "card-band" : undefined}
        onOpen={onOpen}
        openLabel={`Открыть перк: ${name}`}
      >
        {name}
      </CardTitle>
      {summary && <p className="sheet-perk-summary">{summary}</p>}
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
