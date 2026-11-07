import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type {
  Ability,
  AbilityKind,
  ActionType,
  CharacteristicKey,
} from "../../types";
import type { DamageType } from "../../lib/damageType";
import { BASIC_ABILITY_SOURCE, TIER_ROLL_RANGES, characteristicShort, type Tier } from "../../lib/rule-display";
import { inferDamageType } from "../../lib/damageType";
import { ABILITY_KINDS, actionLabel, kindLabel } from "../../data/actions";
import { Chip } from "../ui";
import { CharacteristicGlyph, CharacteristicGlyphText } from "../CharacteristicGlyph";
import { Icon } from "../Icons";
import { DamageChip } from "../DamageChip";
import "../AbilityCard.css";

/**
 * Общая презентация способности без героя.
 *
 * Модель собирают два места: `referenceAbilityView` ниже показывает только
 * напечатанные в книге значения, а `abilityCardView` в соседнем модуле
 * добавляет расчёты листа. Разметку используют и карточка листа, и чтение
 * правил — второго рендера способности не существует: страница Кодекса
 * рисует ту же карточку (`sheet-ability-card`), а не свою копию.
 */

export interface AbilityOrigin {
  label: string;
  value?: string;
}

export interface AbilityFactView {
  label: string;
  value: string;
  title?: string;
  /** Rich source text keeps authored links in monster cards. */
  content?: ReactNode;
}

export interface AbilityTierView {
  tier: Tier;
  range: string;
  rangeTitle: string;
  damage?: { value: string; type?: DamageType; label?: ReactNode };
  effect?: string;
  effectContent?: ReactNode;
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
  roll?: { characteristic: CharacteristicKey; bonus: number } | null;
  /** Флейвор источника: показывается только в полной карточке Кодекса. */
  flavor?: string;
  /** Напечатанный триггер источника: только для способностей-триггеров. */
  trigger?: string;
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
    flavor: ability.flavor,
    trigger: ability.trigger,
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
  const [collapsed, setCollapsed] = useState(false);
  const tagsRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const tags = (
    <>
      <Chip tone={kindTone(view.kind)}>{kindLabel(view.kind)}</Chip>
      {view.origin && (
        <Chip tone="accent" title={view.origin.value ? `${view.origin.label}: ${view.origin.value}` : view.origin.label}>
          {view.origin.label}
        </Chip>
      )}
      {view.basic && <Chip>Базовая</Chip>}
    </>
  );

  useLayoutEffect(() => {
    const header = tagsRef.current?.closest("header");
    const measure = measureRef.current;
    const heading = header?.querySelector("h4, h2");
    if (!header || !heading || !measure) return;
    const update = () => {
      const title = heading.querySelector("button") ?? heading;
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (!context) return;
      const style = getComputedStyle(title);
      context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      const titleWidth = context.measureText(title.textContent || "").width;
      const costWidth = tagsRef.current?.querySelector(".sheet-ability-cost-stamp")?.getBoundingClientRect().width ?? 0;
      const innerWidth = header.clientWidth - parseFloat(getComputedStyle(header).paddingLeft) - parseFloat(getComputedStyle(header).paddingRight);
      setCollapsed(titleWidth + measure.scrollWidth + costWidth + 16 > innerWidth);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(header);
    document.fonts?.ready.then(update);
    return () => observer.disconnect();
  }, [view.kind, view.origin?.label, view.basic, view.resourceCost]);

  return (
    <div className="sheet-ability-card-tags" ref={tagsRef}>
      <div className="sheet-ability-tags-measure" ref={measureRef} aria-hidden="true">{tags}</div>
      {collapsed ? (
        <details className="sheet-ability-tags-more" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
          <summary aria-label="Показать метки способности" title="Метки способности">…</summary>
          <div className="sheet-ability-tags-popover">{tags}</div>
        </details>
      ) : tags}
      {view.resourceCost > 0 && (
        <span className="sheet-ability-cost-stamp is-paid" role="img" aria-label={`Стоимость: ${view.resourceCost} ресурса`} title={`Стоимость: ${view.resourceCost} ресурса`}>
          {view.resourceCost}
        </span>
      )}
    </div>
  );
}

/** Общая строка параметров карточки и окна способности. */
export function AbilityFacts({ view }: { view: Pick<AbilitySheetView, 'facts' | 'roll' | 'keywords'> }) {
  return (
    <div className="sheet-ability-meta">
      {view.facts.map((fact) => (
        <span className="sheet-ability-fact" key={fact.label} title={fact.title || fact.label}>
          <span className="sheet-ability-fact-mark" aria-hidden="true">
            {fact.label === "Бросок" && view.roll ? (
              <CharacteristicGlyph characteristic={view.roll.characteristic} />
            ) : fact.label === "Ключевые слова" ? (
              <Icon name="tag" size={14} />
            ) : fact.label === "Бросок" ? (
              <Icon name="dice" size={14} />
            ) : (
              <span className={`sheet-ability-fact-icon is-${fact.label === "Дист." ? "distance" : fact.label === "Цель" ? "target" : "action"}`} />
            )}
          </span>
          <span className="sheet-ability-fact-value">
            <span className="sr-only">{fact.title || fact.label}: </span>
            {fact.content ?? <CharacteristicGlyphText text={fact.value || "—"} />}
          </span>
        </span>
      ))}
      {view.keywords.length > 0 && (
        <span className="sheet-ability-fact sheet-ability-keywords" title="Ключевые слова">
          <span className="sheet-ability-fact-mark" aria-hidden="true"><Icon name="tag" size={14} /></span>
          <span className="sheet-ability-fact-value">
            <span className="sr-only">Ключевые слова: </span>
            {view.keywords.map((keyword, index) => (
              <span className="sheet-ability-keyword" key={`${keyword}-${index}`}>
                {index > 0 && ", "}{keyword}
              </span>
            ))}
          </span>
        </span>
      )}
    </div>
  );
}

/**
 * Тело карточки способности: факты, метки, тиры с уроном и эффектами,
 * эффект. В карточке длинный текст ограничен по высоте; полное превью
 * и текст правила показывают его целиком.
 */
export function AbilityBody({
  view,
  full = false,
}: {
  view: AbilitySheetView;
  full?: boolean;
}) {
  const tiers = view.tiers;

  return (
    <>
      <AbilityFacts view={view} />

      <AbilityTiers tiers={tiers} />

      {view.effect && (
        <p className={`sheet-ability-body${full ? " is-full-body" : ""}`}>
          <CharacteristicGlyphText text={view.effect} />
        </p>
      )}

      {view.forcedMovement && (
        <p
          className="sheet-ability-forced"
          title="Прибавка от особенностей к принудительному движению"
        >
          <CharacteristicGlyphText text={view.forcedMovement} />
        </p>
      )}
    </>
  );
}

/** Shared tier rows; rich source effects are rendered without losing links. */
export function AbilityTiers({ tiers }: { tiers: AbilityTierView[] }) {
  return tiers.length > 0 ? (
        <div className="sheet-ability-tiers">
          {tiers.map((tier) => (
            <div
              className="sheet-ability-tier"
              data-tier={tier.tier}
              key={tier.tier}
            >
              <span className="sheet-ability-range mono" title={tier.rangeTitle}>
                <span className={`sheet-ability-tier-glyph tier-${tier.tier}`} aria-hidden="true" />
                <span className="sr-only">{tier.range}</span>
              </span>
              {tier.damage && (
                <DamageChip value={tier.damage.value} type={tier.damage.type} label={tier.damage.label} />
              )}
              {(tier.effectContent || tier.effect) && (
                <div className="sheet-ability-effect">{tier.effectContent ?? <CharacteristicGlyphText text={tier.effect ?? ''} />}</div>
              )}
            </div>
          ))}
        </div>
  ) : null;
}
