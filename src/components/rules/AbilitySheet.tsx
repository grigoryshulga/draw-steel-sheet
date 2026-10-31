import type {
  Ability,
  AbilityKind,
  ActionType,
} from "../../types";
import type { DamageType } from "../../lib/damageType";
import { BASIC_ABILITY_SOURCE, TIER_ROLL_RANGES, characteristicShort, type Tier } from "../../lib/rule-display";
import { inferDamageType } from "../../lib/damageType";
import { ABILITY_KINDS, actionLabel, kindLabel } from "../../data/actions";
import { Chip } from "../ui";
import { DamageChip } from "../DamageChip";
import "../AbilityCard.css";

/**
 * Общая презентация способности без героя.
 *
 * Модель собирают два места: `referenceAbilityView` ниже показывает только
 * напечатанные в книге значения, а `abilityCardView` в соседнем модуле
 * добавляет расчёты листа. Разметку используют и карточка листа, и чтение
 * правил — второго рендера способности не существует.
 */

export interface AbilityOrigin {
  label: string;
  value?: string;
}

export interface AbilityFactView {
  label: string;
  value: string;
  title?: string;
}

export interface AbilityTierView {
  tier: Tier;
  range: string;
  rangeTitle: string;
  damage?: { value: string; type?: DamageType };
  effect?: string;
}

export interface AbilitySheetView {
  kind: AbilityKind;
  actionType: ActionType;
  origin?: AbilityOrigin | null;
  resourceCost: number;
  basic: boolean;
  facts: AbilityFactView[];
  keywords: string[];
  tiers: AbilityTierView[];
  effect: string;
  forcedMovement: string;
}

export interface VisibleAbilityTier {
  tier: Tier;
  damage: string;
  effect: string;
}

export function visibleAbilityTiers(ability: Ability): VisibleAbilityTier[] {
  return ability.tiers
    .map((tier, index) => ({
      tier: (index + 1) as Tier,
      damage: tier.damage,
      effect: tier.effect,
    }))
    .filter((tier) => tier.damage || tier.effect);
}

/** Поля, общие для карточки листа и справочной проекции. */
export function abilitySheetBase(ability: Ability) {
  return {
    kind: ability.kind,
    actionType: ability.actionType,
    resourceCost: ability.resourceCost,
    basic: ability.source === BASIC_ABILITY_SOURCE,
    keywords: ability.keywords,
    effect: ability.effect,
  };
}

/** «М или Л +1»: та же строка, что и в футере карточки листа. */
export function abilityRollSummary(
  ability: Pick<Ability, "rollCharacteristics" | "rollBonus">,
): string {
  const parts = ability.rollCharacteristics.map(
    (key) => characteristicShort(key),
  );
  if (parts.length === 0) return "—";
  let text = parts.join(" или ");
  if (ability.rollBonus !== 0)
    text += `${ability.rollBonus > 0 ? " +" : " −"}${Math.abs(ability.rollBonus)}`;
  return text;
}

function kindTone(kind: AbilityKind): "default" | "accent" | "blue" | "magenta" {
  return (ABILITY_KINDS.find((item) => item.key === kind)?.tone ??
    "default") as "default" | "accent" | "blue" | "magenta";
}

/**
 * Напечатанные в книге значения без героя: чтение правил не создаёт Character
 * и не подставляет расчёты листа.
 */
export function referenceAbilityView(ability: Ability): AbilitySheetView {
  return {
    ...abilitySheetBase(ability),
    origin: null,
    facts: [
      {
        label: "Действие",
        value: actionLabel(ability.actionType),
        title: "Тип действия",
      },
      { label: "Дист.", value: ability.distance, title: "Дистанция" },
      { label: "Цель", value: ability.target, title: "Цель" },
      { label: "Бросок", value: abilityRollSummary(ability), title: "Бросок силы" },
    ],
    tiers: visibleAbilityTiers(ability).map((tier) => ({
      tier: tier.tier,
      range: TIER_ROLL_RANGES[tier.tier],
      rangeTitle: "Диапазон суммы броска силы",
      damage: tier.damage
        ? {
            value: tier.damage,
            type: inferDamageType(ability, tier.effect),
          }
        : undefined,
      effect: tier.effect,
    })),
    forcedMovement: "",
  };
}

export function AbilityTags({ view }: { view: AbilitySheetView }) {
  return (
    <div className="sheet-ability-card-tags">
      <Chip tone={kindTone(view.kind)}>{kindLabel(view.kind)}</Chip>
      {view.origin && (
        <Chip
          tone="accent"
          title={
            view.origin.value
              ? `${view.origin.label}: ${view.origin.value}`
              : view.origin.label
          }
        >
          {view.origin.label}
        </Chip>
      )}
      {view.basic && <Chip>Базовая</Chip>}
      {view.resourceCost > 0 && (
        <span
          className="sheet-ability-cost-stamp is-paid"
          role="img"
          aria-label={`Стоимость: ${view.resourceCost} ресурса`}
          title={`Стоимость: ${view.resourceCost} ресурса`}
        >
          {view.resourceCost}
        </span>
      )}
    </div>
  );
}

export function AbilityBody({
  view,
  full = false,
  variant = "card",
}: {
  view: AbilitySheetView;
  full?: boolean;
  /**
   * `summary` — компактная справка для чтения правил: только факты, метки и
   * урон тиров. Полные описания остаются в `entity.markdown` и не дублируются
   * сокращённой проекцией.
   */
  variant?: "card" | "summary";
}) {
  const tiers =
    variant === "summary" ? view.tiers.filter((tier) => tier.damage) : view.tiers;

  return (
    <>
      <div className="sheet-ability-meta">
        {view.facts.map((fact) => (
          <span key={fact.label} title={fact.title}>
            <em>{fact.label}</em> {fact.value || "—"}
          </span>
        ))}
      </div>

      {view.keywords.length > 0 && (
        <div className="sheet-ability-keywords">
          {view.keywords.slice(0, 4).map((keyword) => (
            <span className="sheet-ability-keyword" key={keyword}>
              {keyword}
            </span>
          ))}
        </div>
      )}

      {tiers.length > 0 && (
        <div className="sheet-ability-tiers">
          {tiers.map((tier) => (
            <div
              className="sheet-ability-tier"
              data-tier={tier.tier}
              key={tier.tier}
            >
              <span className="sheet-ability-range mono" title={tier.rangeTitle}>
                {tier.range}
              </span>
              {tier.damage && (
                <DamageChip value={tier.damage.value} type={tier.damage.type} />
              )}
              {variant === "card" && tier.effect && (
                <span className="sheet-ability-effect">{tier.effect}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {variant === "card" && view.effect && (
        <p className={`sheet-ability-body${full ? " is-full-body" : ""}`}>
          {view.effect}
        </p>
      )}

      {variant === "card" && view.forcedMovement && (
        <p
          className="sheet-ability-forced"
          title="Прибавка от особенностей к принудительному движению"
        >
          {view.forcedMovement}
        </p>
      )}
    </>
  );
}
