import { abilityDistance } from "../../lib/character-calculations";
import { useEffect, useState } from "react";
import type { Ability, Character } from "../../types";
import { actionShort, kindLabel } from "../../data/actions";
import { Button, Chip } from "../../components/ui";
import { Icon } from "../../components/Icons";
import { TierList, kindTone, rollSummary } from "./shared";
import { preferredCharacteristic } from "../../lib/abilities";
import { characteristicShort } from "../../lib/rules";
import { RichText } from "../../components/RichText";

export interface AbilityCardProps {
  ability: Ability;
  character: Character;
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onRoll: () => void;
}

export function AbilityCard({
  ability,
  character,
  expanded,
  onToggle,
  onEdit,
  onDuplicate,
  onDelete,
  onRoll,
}: AbilityCardProps) {
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!confirming) return;
    const timer = window.setTimeout(() => setConfirming(false), 3000);
    return () => window.clearTimeout(timer);
  }, [confirming]);

  const canRoll = ability.rollCharacteristics.length > 0;
  const preferred = preferredCharacteristic(ability);

  return (
    <article className={`abil-card ${expanded ? "is-open" : ""}`.trim()}>
      <div className="abil-card-head">
        <button
          type="button"
          className="abil-card-toggle"
          onClick={onToggle}
          aria-expanded={expanded}
          title={expanded ? "Свернуть" : "Развернуть"}
        >
          <Icon name={expanded ? "chevron-down" : "chevron-right"} size={16} />
          <span className="abil-card-name">
            {ability.name || "Без названия"}
          </span>
        </button>
        <div className="abil-card-tags">
          <Chip tone={kindTone(ability.kind)}>{kindLabel(ability.kind)}</Chip>
          {ability.resourceCost > 0 && (
            <Chip tone="yellow" title="Стоимость героического ресурса">
              {ability.resourceCost} ресурса
            </Chip>
          )}
          {ability.trigger && <Chip tone="magenta">Триггер</Chip>}
        </div>
        <span className="abil-card-action mono" title="Тип действия">
          {actionShort(ability.actionType)}
        </span>
      </div>

      {expanded && (
        <div className="abil-card-body">
          {ability.flavor && <p className="abil-flavor">{ability.flavor}</p>}

          {ability.keywords.length > 0 && (
            <div className="abil-keywords">
              {ability.keywords.map((keyword) => (
                <Chip key={keyword}>{keyword}</Chip>
              ))}
            </div>
          )}

          <div className="abil-facts">
            <div className="abil-fact">
              <span className="abil-fact-label">Дистанция</span>
              <span className="abil-fact-value">
                {abilityDistance(ability, character) || "—"}
              </span>
            </div>
            <div className="abil-fact">
              <span className="abil-fact-label">Цель</span>
              <span className="abil-fact-value">{ability.target || "—"}</span>
            </div>
            <div className="abil-fact">
              <span className="abil-fact-label">Бросок</span>
              <span className="abil-fact-value mono">
                {rollSummary(ability)}
              </span>
            </div>
            {preferred && (
              <div className="abil-fact">
                <span className="abil-fact-label">Предпочтительная</span>
                <span className="abil-fact-value mono">
                  {characteristicShort(preferred)}
                </span>
              </div>
            )}
            <div className="abil-fact">
              <span className="abil-fact-label">Стоимость</span>
              <span className="abil-fact-value mono">
                {ability.resourceCost > 0 ? ability.resourceCost : "—"}
              </span>
            </div>
          </div>

          <TierList ability={ability} character={character} />

          {ability.trigger && (
            <div className="abil-block abil-block-trigger">
              <span className="abil-block-label">Триггер</span>
              <RichText text={ability.trigger} />
            </div>
          )}
          {ability.effect && (
            <div className="abil-block">
              <span className="abil-block-label">Эффект</span>
              <RichText text={ability.effect} />
            </div>
          )}
          {ability.notes && (
            <div className="abil-block abil-block-notes">
              <span className="abil-block-label">Заметки</span>
              <RichText text={ability.notes} />
            </div>
          )}
          {ability.source && (
            <p className="abil-source muted small">
              Источник: {ability.source}
            </p>
          )}

          <div className="abil-card-actions">
            <Button
              variant="primary"
              size="sm"
              icon="dice"
              disabled={!canRoll}
              onClick={onRoll}
            >
              Бросок
            </Button>
            <Button size="sm" icon="edit" onClick={onEdit}>
              Изменить
            </Button>
            <Button size="sm" icon="copy" onClick={onDuplicate}>
              Дублировать
            </Button>
            <Button
              size="sm"
              variant={confirming ? "danger" : "ghost"}
              icon="trash"
              onClick={() => (confirming ? onDelete() : setConfirming(true))}
              onBlur={() => setConfirming(false)}
            >
              {confirming ? "Точно удалить?" : "Удалить"}
            </Button>
          </div>
        </div>
      )}
    </article>
  );
}
