import { basicActionEditions } from "../../rules/consumer-basic-actions";
import { useLocale } from "../../i18n/locale";
import { useMemo } from "react";
import type { Ability } from "../../types";
import { actionShort, kindLabel } from "../../data/actions";
import { BASIC_ABILITIES, abilityFromTemplate } from "../../data/templates";
import { Button, Chip, EmptyState, Modal } from "../../components/ui";
import { Icon } from "../../components/Icons";
import { kindTone, ownershipKey, rollSummary } from "./shared";

export interface TemplatesModalProps {
  existing: Ability[];
  onClose: () => void;
  onAdd: (ability: Ability) => void;
}

/** Быстрое добавление базовых действий (главы 13.09–13.11). */
export function TemplatesModal({ existing, onClose, onAdd }: TemplatesModalProps) {
  const { t, locale } = useLocale();
  const owned = useMemo(() => {
    const set = new Set<string>();
    for (const ability of existing) set.add(ownershipKey(ability.name, ability.source));
    return set;
  }, [existing]);

  return (
    <Modal
      open
      onClose={onClose}
      className="abil-templates-modal"
      title={
        <span className="abil-templates-title">
          <Icon name="sword" size={18} />
          {t("Базовые действия", "Basic actions")}
        </span>
      }
    >
      {BASIC_ABILITIES.length === 0 ? (
        <EmptyState icon="sword" title={t("Шаблоны недоступны", "Templates unavailable")} />
      ) : (
        <div className="abil-templates-list">
          {BASIC_ABILITIES.map((template, index) => {
            const edition = locale === "en" ? basicActionEditions[template.name] : undefined;
            const name = edition?.name ?? template.name;
            const isOwned = owned.has(ownershipKey(template.name, template.source));
            return (
              <div className="abil-template-row" key={index}>
                <div className="abil-template-text">
                  <span className="abil-template-name">
                    {name}
                    {isOwned && <span className="abil-owned-badge">{t("в листе", "on sheet")}</span>}
                  </span>
                  <span className="abil-template-meta">
                    <Chip tone={kindTone(template.kind)}>{kindLabel(template.kind, locale)}</Chip>
                    <span className="mono">{edition?.action ?? actionShort(template.actionType)}</span>
                    <span className="muted small">{edition?.distance ?? template.distance}</span>
                  </span>
                  <span className="muted small">
                    {edition?.summary ?? (template.rollCharacteristics.length > 0
                      ? `Бросок: ${rollSummary(template)}`
                      : template.effect || "—")}
                  </span>
                </div>
                <Button
                  size="sm"
                  icon="plus"
                  onClick={() => onAdd(abilityFromTemplate(template))}
                  aria-label={t(`Добавить: ${name}`, `Add: ${name}`)}
                >
                  {t("Добавить", "Add")}
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
