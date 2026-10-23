import { abilityDistance } from "../../lib/character-calculations";
import { useState } from "react";
import { RollModal } from "../abilities/RollModal";
import { Button, Chip, EmptyState, Modal, Panel } from "../../components/ui";
import { RichText } from "../../components/RichText";
import { DamageChip } from "../../components/DamageChip";
import { TierBadge } from "../../components/TierBadge";
import { ACTION_TYPES, actionLabel, kindLabel } from "../../data/actions";
import {
  characteristicShort,
  evaluateAbilityDamage,
  TIER_ROLL_RANGES,
  type Tier,
} from "../../lib/rules";
import { inferDamageType } from "../../lib/damageType";
import { useApp } from "../../state/AppContext";
import type { Ability } from "../../types";
import {
  TierRequirementSummary,
  kindTone,
  rollSummary,
} from "../abilities/shared";
import {
  abilityTierRequirements,
  preferredCharacteristic,
  tierRequirementText,
} from "../../lib/abilities";
import "./SheetAbilitiesPanel.css";

/** Компактный справочник способностей внизу листа, сгруппированный по типу действия. */
export function SheetAbilitiesPanel() {
  const { character, goTo } = useApp();
  const [selected, setSelected] = useState<Ability | null>(null);
  const [using, setUsing] = useState<Ability | null>(null);
  const abilities = character.abilities;
  const groups = ACTION_TYPES.map((type) => ({
    ...type,
    items: abilities.filter((ability) => ability.actionType === type.key),
  })).filter((group) => group.items.length > 0);

  const openAbility = (ability: Ability) => setSelected(ability);

  return (
    <>
      <Panel
        title="Способности"
        icon="abilities"
        className="sheet-abilities-panel"
        actions={
          <Button
            size="sm"
            variant="ghost"
            icon="abilities"
            onClick={() => goTo("abilities")}
          >
            Подробнее
          </Button>
        }
      >
        {abilities.length === 0 ? (
          <EmptyState
            icon="abilities"
            title="Способностей пока нет"
            text="Добавьте способности на вкладке «Способности»."
            action={
              <Button onClick={() => goTo("abilities")}>
                Открыть способности
              </Button>
            }
          />
        ) : (
          <div className="sheet-ability-sections">
            {groups.map((group) => (
              <section className="sheet-ability-section" key={group.key}>
                <header className="sheet-ability-section-head">
                  <h3>{group.label}</h3>
                  <span className="sheet-ability-count mono">
                    {group.items.length}
                  </span>
                  <span className="sheet-ability-rule" />
                </header>

                <div className="sheet-ability-grid">
                  {group.items.map((ability) => {
                    const requirements = abilityTierRequirements(
                      ability,
                      character,
                    );
                    const tiers = ability.tiers
                      .map((tier, index) => ({
                        ...tier,
                        tier: (index + 1) as Tier,
                      }))
                      .filter((tier) => tier.damage || tier.effect);
                    return (
                      <article className="sheet-ability-card" key={ability.id}>
                        <header className="sheet-ability-card-head">
                          <h4>
                            <button
                              type="button"
                              className="sheet-ability-title"
                              aria-label={`Открыть способность: ${ability.name || "без названия"}`}
                              onClick={() => openAbility(ability)}
                            >
                              {ability.name || "Без названия"}
                            </button>
                          </h4>
                          <div className="sheet-ability-card-tags">
                            <Chip tone={kindTone(ability.kind)}>
                              {kindLabel(ability.kind)}
                            </Chip>
                            {ability.resourceCost > 0 && (
                              <span
                                className="sheet-ability-cost-stamp is-paid"
                                title={`Стоимость: ${ability.resourceCost}`}
                              >
                                {ability.resourceCost}
                              </span>
                            )}
                          </div>
                        </header>

                        <div className="sheet-ability-meta">
                          <span title="Дистанция">
                            <em>Дист.</em>{" "}
                            {abilityDistance(ability, character) || "—"}
                          </span>
                          <span title="Цель">
                            <em>Цель</em> {ability.target || "—"}
                          </span>
                        </div>

                        {ability.keywords.length > 0 && (
                          <div className="sheet-ability-keywords">
                            {ability.keywords.slice(0, 4).map((keyword) => (
                              <span
                                className="sheet-ability-keyword"
                                key={keyword}
                              >
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
                                  key={tier.tier}
                                >
                                  <TierBadge tier={tier.tier} size="md" />
                                  <div className="sheet-ability-tier-text">
                                    <div className="sheet-ability-tier-top">
                                      <span
                                        className="sheet-ability-range mono"
                                        title={
                                          requirements
                                            ? "Нужно выбросить на 2d10"
                                            : "Диапазон суммы броска силы"
                                        }
                                      >
                                        {requirements
                                          ? tierRequirementText(
                                              requirements,
                                              tier.tier,
                                            )
                                          : TIER_ROLL_RANGES[tier.tier]}
                                      </span>
                                      {tier.damage && (
                                        <DamageChip
                                          value={damage.display}
                                          type={inferDamageType(
                                            ability,
                                            tier.effect,
                                          )}
                                        />
                                      )}
                                    </div>
                                    {tier.effect && (
                                      <span className="sheet-ability-effect">
                                        {tier.effect}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {tiers.length === 0 && ability.effect && (
                          <p className="sheet-ability-body">{ability.effect}</p>
                        )}

                        <footer className="sheet-ability-footer">
                          <span title="Бросок силы">
                            <em>Бросок</em> {rollSummary(ability)}
                          </span>
                          {ability.trigger && (
                            <span className="sheet-ability-trigger">
                              триггер
                            </span>
                          )}
                          <Button
                            size="sm"
                            variant="soft"
                            icon="abilities"
                            aria-label={`Использовать: ${ability.name}`}
                            onClick={() => setUsing(ability)}
                          >
                            Использовать
                          </Button>
                        </footer>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </Panel>

      {selected && (
        <AbilityDetailModal
          ability={selected}
          onClose={() => setSelected(null)}
          onUse={() => {
            setUsing(selected);
            setSelected(null);
          }}
          onOpenAll={() => {
            setSelected(null);
            goTo("abilities");
          }}
        />
      )}
      {using && (
        <RollModal
          key={using.id}
          ability={using}
          character={character}
          onClose={() => setUsing(null)}
        />
      )}
    </>
  );
}

function AbilityDetailModal({
  ability,
  onClose,
  onOpenAll,
  onUse,
}: {
  ability: Ability;
  onClose: () => void;
  onOpenAll: () => void;
  onUse: () => void;
}) {
  const { character } = useApp();
  const requirements = abilityTierRequirements(ability, character);
  const tiers = ability.tiers
    .map((tier, index) => ({ ...tier, tier: (index + 1) as Tier }))
    .filter((tier) => tier.damage || tier.effect);

  return (
    <Modal
      open
      onClose={onClose}
      wide
      title={
        <span className="sheet-ability-detail-title">
          {ability.name || "Без названия"}
        </span>
      }
      footer={
        <>
          <span className="grow" />
          <Button variant="ghost" onClick={onClose}>
            Закрыть
          </Button>
          <Button variant="ghost" icon="abilities" onClick={onOpenAll}>
            Открыть на вкладке
          </Button>
          <Button variant="primary" onClick={onUse}>
            Использовать
          </Button>
        </>
      }
    >
      <div className="sheet-ability-detail">
        <div className="hstack wrap">
          <Chip tone={kindTone(ability.kind)}>{kindLabel(ability.kind)}</Chip>
          {ability.resourceCost > 0 && (
            <Chip tone="yellow">Стоимость: {ability.resourceCost}</Chip>
          )}
          {ability.keywords.map((keyword) => (
            <Chip key={keyword}>{keyword}</Chip>
          ))}
        </div>

        {ability.flavor && (
          <p className="sheet-ability-detail-flavor">{ability.flavor}</p>
        )}

        <div className="sheet-ability-detail-facts">
          <div>
            <span className="eyebrow">Дистанция</span>
            <span>{abilityDistance(ability, character) || "—"}</span>
          </div>
          <div>
            <span className="eyebrow">Цель</span>
            <span>{ability.target || "—"}</span>
          </div>
          <div>
            <span className="eyebrow">Бросок силы</span>
            <span className="mono">{rollSummary(ability)}</span>
          </div>
          {preferredCharacteristic(ability) && (
            <div>
              <span className="eyebrow">Предпочтительная</span>
              <span className="mono">
                {characteristicShort(preferredCharacteristic(ability)!)}
              </span>
            </div>
          )}
          <div>
            <span className="eyebrow">Стоимость</span>
            <span>
              {ability.resourceCost > 0
                ? `${ability.resourceCost} ресурса`
                : "—"}
            </span>
          </div>
          <div>
            <span className="eyebrow">Тип действия</span>
            <span>{actionLabel(ability.actionType)}</span>
          </div>
        </div>

        {ability.trigger && (
          <div className="sheet-ability-detail-block sheet-ability-detail-trigger">
            <span className="eyebrow">Триггер</span>
            <RichText text={ability.trigger} />
          </div>
        )}

        {tiers.length > 0 && (
          <>
            <TierRequirementSummary ability={ability} character={character} />
            <div className="sheet-ability-detail-tiers">
              {tiers.map((tier) => {
                const damage = evaluateAbilityDamage(
                  ability,
                  tier.tier,
                  character,
                );
                return (
                  <div
                    className="sheet-ability-detail-tier"
                    data-tier={tier.tier}
                    key={tier.tier}
                  >
                    <div className="sheet-ability-detail-tier-head">
                      <TierBadge tier={tier.tier} size="md" />
                      <span className="sheet-ability-detail-range mono">
                        {requirements
                          ? tierRequirementText(requirements, tier.tier)
                          : TIER_ROLL_RANGES[tier.tier]}
                      </span>
                      <span className="grow" />
                      {tier.damage && (
                        <DamageChip
                          value={damage.display}
                          type={inferDamageType(ability, tier.effect)}
                        />
                      )}
                    </div>
                    {tier.effect && <RichText text={tier.effect} />}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {ability.effect && (
          <div className="sheet-ability-detail-block">
            <span className="eyebrow">Эффект</span>
            <RichText text={ability.effect} />
          </div>
        )}

        {ability.notes && (
          <div className="sheet-ability-detail-block sheet-ability-detail-notes">
            <span className="eyebrow">Заметки</span>
            <RichText text={ability.notes} />
          </div>
        )}
      </div>
    </Modal>
  );
}
