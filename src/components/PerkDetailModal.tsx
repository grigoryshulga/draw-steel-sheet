import { useEffect, useState, type ReactNode } from "react";
import { perkById, PERK_TYPE_META } from "../data/perks";
import { loadRuleEntity } from "../rules/repository";
import { RuleText } from "./RuleText";
import { useArticleLocale, useLocale, useRuleLanguage } from "../i18n/locale";
import { ArticleLanguageSwitch } from "./LanguageSwitch";
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
  const { t, locale } = useLocale();
  const articleLocale = useArticleLocale();
  const meta = type ? PERK_TYPE_META[type] : null;
  const perk = perkId ? perkById(perkId) : undefined;
  const control = useRuleLanguage(perk?.id || "custom", perk?.originalDescription);
  return (
    <CardDetailModal
      open={open}
      onClose={onClose}
      title={(control.language === "en" && perk?.originalName) || name || t("Перк", "Perk")}
      source={eyebrow}
      meta={meta ? <Chip tone={meta.tone}>{locale === "en" && type ? ({ crafting: "Crafting", exploration: "Exploration", interpersonal: "Interpersonal", intrigue: "Intrigue", lore: "Lore", supernatural: "Supernatural" } as const)[type] : meta.label}</Chip> : undefined}
      headerActions={control.available && !articleLocale ? <ArticleLanguageSwitch language={control.language} setLanguage={control.setLanguage} /> : undefined}
      footer={action}
      autoHeight
    >
      <PerkRulesText perkId={perkId} fallback={description || summary} control={control} />
    </CardDetailModal>
  );
}

export function PerkRulesText({ perkId, fallback, control }: { perkId?: string; fallback?: string; control?: ReturnType<typeof useRuleLanguage> }) {
  const { t } = useLocale();
  const perk = perkId ? perkById(perkId) : undefined;
  const catalogId = perk?.id;
  const localControl = useRuleLanguage(catalogId || "custom", perk?.originalDescription);
  const { language, available } = control ?? localControl;
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
  if (language === "en" && available) return <>
    <RuleText text={perk!.originalDescription!} sourceLocale="en" />
  </>;
  if (catalogId && catalogText === undefined) {
    return <p className="muted" role="status">{t("Загружаем описание…", "Loading description…")}</p>;
  }
  const text = catalogText || fallback;
  return <>
    {text ? <RuleText text={text} sharedAbilityCards /> : <p className="muted">{t("Полное описание этого перка недоступно.", "The full perk description is unavailable.")}</p>}
  </>;
}
