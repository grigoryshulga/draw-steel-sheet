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
          Базовые действия
        </span>
      }
      footer={
        <div className="abil-templates-footer">
          <span className="grow" />
          <Button variant="ghost" onClick={onClose}>
            Закрыть
          </Button>
        </div>
      }
    >
      {BASIC_ABILITIES.length === 0 ? (
        <EmptyState icon="sword" title="Шаблоны недоступны" />
      ) : (
        <div className="abil-templates-list">
          {BASIC_ABILITIES.map((template, index) => {
            const isOwned = owned.has(ownershipKey(template.name, template.source));
            return (
              <div className="abil-template-row" key={index}>
                <div className="abil-template-text">
                  <span className="abil-template-name">
                    {template.name}
                    {isOwned && <span className="abil-owned-badge">в листе</span>}
                  </span>
                  <span className="abil-template-meta">
                    <Chip tone={kindTone(template.kind)}>{kindLabel(template.kind)}</Chip>
                    <span className="mono">{actionShort(template.actionType)}</span>
                    <span className="muted small">{template.distance}</span>
                  </span>
                  <span className="muted small">
                    {template.rollCharacteristics.length > 0
                      ? `Бросок: ${rollSummary(template)}`
                      : template.effect || "—"}
                  </span>
                </div>
                <Button
                  size="sm"
                  icon="plus"
                  onClick={() => onAdd(abilityFromTemplate(template))}
                  aria-label={`Добавить: ${template.name}`}
                >
                  Добавить
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
