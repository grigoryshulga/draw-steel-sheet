import type { KeyboardEvent, ReactNode } from "react";
import {
  abilityDistance,
  abilityForcedMovementLine,
} from "../lib/character-calculations";
import { DamageChip } from "./DamageChip";
import { Chip } from "./ui";
import { kindLabel } from "../data/actions";
import {
  evaluateAbilityDamage,
  TIER_ROLL_RANGES,
  type Tier,
} from "../lib/rules";
import { inferDamageType } from "../lib/damageType";
import type { Ability, Character } from "../types";
import { kindTone, rollSummary } from "../views/abilities/shared";
import { BASIC_ABILITY_SOURCE } from "../lib/ability-sheet-groups";
import {
  abilityTierRequirements,
  tierRequirementText,
} from "../lib/abilities";
import "./AbilityCard.css";

export interface AbilityCardProps {
  ability: Ability;
  character: Character;
  /** Происхождение из подкласса: «Орден», «Домен», «Доктрина» и т. п. */
  origin?: { label: string; value?: string } | null;
  onOpen?: () => void;
  /** Карточка участвует в выборе: клик выбирает, заголовок открывает превью. */
  onSelect?: () => void;
  selected?: boolean;
  /** Полное превью: эффект не обрезается. */
  full?: boolean;
  /** Без рамки и фона: карточка как содержимое поп-апа, а не карточка в карточке. */
  flat?: boolean;
  footerAction?: ReactNode;
  details?: ReactNode;
  className?: string;
}

export function AbilityCard({
  ability,
  character,
  origin,
  onOpen,
  onSelect,
  selected = false,
  full = false,
  flat = false,
  footerAction,
  details,
  className,
}: AbilityCardProps) {
  const requirements = abilityTierRequirements(ability, character);
  const tiers = ability.tiers
    .map((tier, index) => ({ ...tier, tier: (index + 1) as Tier }))
    .filter((tier) => tier.damage || tier.effect);
  // Добавка особенностей к принудительному движению — отдельной строкой только
  // там, где способность действительно двигает цель: текст тиров остаётся
  // как напечатан в книге.
  const forcedMovement = abilityForcedMovementLine(ability, character);

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!onSelect || event.target !== event.currentTarget) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect();
    }
  };

  return (
    <article
      className={`sheet-ability-card${selected ? " is-selected" : ""}${full ? " is-full" : ""}${flat ? " is-flat" : ""}${className ? ` ${className}` : ""}`}
      data-action={ability.actionType}
      data-kind={ability.kind}
      {...(onSelect
        ? {
            role: "button",
            tabIndex: 0,
            "aria-pressed": selected,
            onClick: onSelect,
            onKeyDown,
          }
        : {})}
    >
      <header className="sheet-ability-card-head">
        <h4>
          {onOpen ? (
            <button
              type="button"
              className="sheet-ability-title"
              aria-label={`Открыть способность: ${ability.name || "без названия"}`}
              onClick={(event) => {
                event.stopPropagation();
                onOpen();
              }}
            >
              {ability.name || "Без названия"}
            </button>
          ) : (
            ability.name || "Без названия"
          )}
        </h4>
        <div className="sheet-ability-card-tags">
          <Chip tone={kindTone(ability.kind)}>{kindLabel(ability.kind)}</Chip>
          {origin && (
            <Chip
              tone="accent"
              title={origin.value ? `${origin.label}: ${origin.value}` : origin.label}
            >
              {origin.label}
            </Chip>
          )}
          {ability.source === BASIC_ABILITY_SOURCE && <Chip>Базовая</Chip>}
          {ability.resourceCost > 0 && (
            <span
              className="sheet-ability-cost-stamp is-paid"
              role="img"
              aria-label={`Стоимость: ${ability.resourceCost} ресурса`}
              title={`Стоимость: ${ability.resourceCost} ресурса`}
            >
              {ability.resourceCost}
            </span>
          )}
        </div>
      </header>

      <div className="sheet-ability-meta">
        <span title="Дистанция">
          <em>Дист.</em> {abilityDistance(ability, character) || "—"}
        </span>
        <span title="Цель">
          <em>Цель</em> {ability.target || "—"}
        </span>
      </div>

      {ability.keywords.length > 0 && (
        <div className="sheet-ability-keywords">
          {ability.keywords.slice(0, 4).map((keyword) => (
            <span className="sheet-ability-keyword" key={keyword}>
              {keyword}
            </span>
          ))}
        </div>
      )}

      {tiers.length > 0 && (
        <div className="sheet-ability-tiers">
          {tiers.map((tier) => {
            const damage = evaluateAbilityDamage(
              ability,
              tier.tier,
              character,
            );
            return (
              <div
                className="sheet-ability-tier"
                data-tier={tier.tier}
                key={tier.tier}
              >
                <span
                  className="sheet-ability-range mono"
                  title={
                    requirements
                      ? "Нужно выбросить на 2d10"
                      : "Диапазон суммы броска силы"
                  }
                >
                  {requirements
                    ? tierRequirementText(requirements, tier.tier)
                    : TIER_ROLL_RANGES[tier.tier]}
                </span>
                {tier.damage && (
                  <DamageChip
                    value={damage.display}
                    type={inferDamageType(ability, tier.effect)}
                  />
                )}
                {tier.effect && (
                  <span className="sheet-ability-effect">{tier.effect}</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {ability.effect && (
        <p className="sheet-ability-body">{ability.effect}</p>
      )}

      {forcedMovement && (
        <p
          className="sheet-ability-forced"
          title="Прибавка от особенностей к принудительному движению"
        >
          {forcedMovement}
        </p>
      )}

      {details}

      <footer className="sheet-ability-footer">
        <span title="Бросок силы">
          <em>Бросок</em> {rollSummary(ability)}
        </span>
        {ability.trigger && (
          <span className="sheet-ability-trigger">триггер</span>
        )}
        {footerAction && (
          <span
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          >
            {footerAction}
          </span>
        )}
      </footer>
    </article>
  );
}
