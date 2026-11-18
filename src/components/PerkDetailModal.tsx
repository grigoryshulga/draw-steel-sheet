import { useEffect, useState, type ReactNode } from "react";
import { perkById, PERK_TYPE_META } from "../data/perks";
import { loadRuleEntity } from "../rules/repository";
import { RuleText } from "./RuleText";
import { CardDetailModal } from "./CardDetailModal";
import { Chip } from "./ui";
import type { PerkType } from "../types";

export interface PerkDetailModalProps {
  open: boolean;
  onClose: () => void;
  name: string;
  perkId?: string;
  type?: PerkType | null;
  /** Подпись слота: «Карьера», «Класс · 2 уровень» и т. п. */
  eyebrow?: string;
  summary?: string;
  description?: string;
  /** Действие конкретного экрана: «Заменить», «Выбрать» и т. п. */
  action?: ReactNode;
}

/**
 * Единый поп-ап перка для листа, редактора героя, «Развития» и билдера.
 * Отличается только одно действие в футере; содержимое всегда одинаковое.
 */
export function PerkDetailModal({
  open,
  onClose,
  name,
  perkId,
  type,
  eyebrow,
  summary,
  description,
  action,
}: PerkDetailModalProps) {
  const meta = type ? PERK_TYPE_META[type] : null;
  return (
    <CardDetailModal
      open={open}
      onClose={onClose}
      title={name || "Перк"}
      source={eyebrow}
      meta={meta ? <Chip tone={meta.tone}>{meta.label}</Chip> : undefined}
      footer={action}
      autoHeight
    >
      <PerkRulesText perkId={perkId} fallback={description || summary} />
    </CardDetailModal>
  );
}

export function PerkRulesText({ perkId, fallback }: { perkId?: string; fallback?: string }) {
  const catalogId = perkId ? perkById(perkId)?.id : undefined;
  const [loaded, setLoaded] = useState<{ id: string; text: string }>();

  useEffect(() => {
    if (!catalogId) return;
    let active = true;
    void loadRuleEntity(catalogId).then(
      (entity) => {
        if (!active) return;
        const text = entity.markdown.replace(/^\s*#{1,6}\s+[^\n]*\n+/, "").trim();
        setLoaded({ id: catalogId, text });
      },
      () => {
        if (active) setLoaded({ id: catalogId, text: "" });
      },
    );
    return () => { active = false; };
  }, [catalogId]);

  const catalogText = catalogId && loaded?.id === catalogId ? loaded.text : undefined;
  if (catalogId && catalogText === undefined) {
    return <p className="muted" role="status">Загружаем описание…</p>;
  }
  const text = catalogText || fallback;
  return text ? <RuleText text={text} sharedAbilityCards /> :
    <p className="muted">Полное описание этого перка недоступно.</p>;
}
