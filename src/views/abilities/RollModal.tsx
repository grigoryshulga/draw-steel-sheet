import { useCallback, useState } from "react";
import type { Ability, Character, CharacteristicKey } from "../../types";
import {
  CHARACTERISTICS,
  evaluateAbilityDamage,
  rollPowerRoll,
  surgeDamage,
  surgeDamageTotal,
  type PowerRollResult,
} from "../../lib/rules";
import {
  Button,
  Chip,
  Field,
  Modal,
  NumberInput,
  Stepper,
} from "../../components/ui";
import { preferredCharacteristic } from "../../lib/abilities";
import { Icon } from "../../components/Icons";
import { RichText } from "../../components/RichText";
import { TierBadge } from "../../components/TierBadge";

export interface RollModalProps {
  ability: Ability;
  character: Character;
  onClose: () => void;
}

export function RollModal({ ability, character, onClose }: RollModalProps) {
  const characteristics = ability.rollCharacteristics;
  const preferred = preferredCharacteristic(ability);
  const [charKey, setCharKey] = useState<CharacteristicKey>(
    preferred && characteristics.includes(preferred)
      ? preferred
      : (characteristics[0] ?? "might"),
  );
  const [edges, setEdges] = useState(0);
  const [banes, setBanes] = useState(0);
  const [bonus, setBonus] = useState(ability.rollBonus);
  const [surges, setSurges] = useState(0);
  const [weaponMode, setWeaponMode] = useState<"melee" | "ranged">(
    ability.weaponMode ?? "melee",
  );
  const [result, setResult] = useState<PowerRollResult | null>(null);

  const roll = useCallback(() => {
    setResult(
      rollPowerRoll({
        characteristic: character.characteristics[charKey],
        edges,
        banes,
        bonus,
        isMainAction: ability.actionType === "main",
      }),
    );
  }, [
    ability.actionType,
    banes,
    bonus,
    charKey,
    character.characteristics,
    edges,
  ]);

  const tier = result ? ability.tiers[result.tier - 1] : null;
  const damage =
    tier && result
      ? evaluateAbilityDamage(
          { ...ability, weaponMode },
          result.tier,
          character,
        )
      : null;
  const surgeBonus = surgeDamageTotal(character, surges);
  const surgeOne = surgeDamage(character);
  const surgeFinal =
    damage && surges > 0
      ? damage.dice.length > 0
        ? [`${damage.display} + ${surgeBonus}`]
        : [...new Set(damage.values.map((value) => value + surgeBonus))]
      : (damage?.values ?? []);
  const isMain = ability.actionType === "main";
  const doubleAdv = edges - banes >= 2;
  const doubleBane = edges - banes <= -2;
  const charLabel = CHARACTERISTICS.find((item) => item.key === charKey);

  return (
    <Modal
      open
      onClose={onClose}
      className="abil-roll-modal"
      title={
        <span className="abil-roll-title">
          <Icon name="dice" size={18} />
          {ability.name || "Без названия"}
        </span>
      }
      footer={
        <div className="abil-roll-footer">
          {ability.resourceCost > 0 && (
            <span className="muted small">
              Стоимость: {ability.resourceCost} ресурса
            </span>
          )}
          <span className="grow" />
          <Button variant="ghost" onClick={onClose}>
            Закрыть
          </Button>
          <Button variant="primary" icon="dice" onClick={roll}>
            {result ? "Ещё бросок" : "Бросить"}
          </Button>
        </div>
      }
    >
      <div className="abil-roll-layout">
        <div className="abil-roll-settings">
          {ability.keywords.includes("Ближний") &&
            ability.keywords.includes("Дальний") && (
              <div className="abil-chips" aria-label="Способ атаки">
                <Chip
                  active={weaponMode === "melee"}
                  onClick={() => setWeaponMode("melee")}
                >
                  Ближний бой
                </Chip>
                <Chip
                  active={weaponMode === "ranged"}
                  onClick={() => setWeaponMode("ranged")}
                >
                  Дальний бой
                </Chip>
              </div>
            )}
          <div className="field">
            <span className="field-label">Характеристика броска</span>
            <div className="abil-chips">
              {characteristics.length === 0 && (
                <span className="muted small">Без броска</span>
              )}
              {characteristics.map((key) => {
                const info = CHARACTERISTICS.find((item) => item.key === key);
                return (
                  <Chip
                    key={key}
                    active={key === charKey}
                    onClick={() => setCharKey(key)}
                    title={info?.label}
                  >
                    {info?.short} {character.characteristics[key]}
                  </Chip>
                );
              })}
            </div>
          </div>

          <div className="abil-roll-grid">
            <Field label="Преимущества">
              <Stepper
                value={edges}
                onChange={setEdges}
                min={0}
                max={2}
                label="Преимущества"
              />
            </Field>
            <Field label="Помехи">
              <Stepper
                value={banes}
                onChange={setBanes}
                min={0}
                max={2}
                label="Помехи"
              />
            </Field>
            <Field label="Бонус">
              <NumberInput
                value={bonus}
                onChange={setBonus}
                min={-10}
                max={20}
                label="Бонус броска"
              />
            </Field>
            <Field label="Всплески">
              <Stepper
                value={surges}
                onChange={setSurges}
                min={0}
                max={3}
                label="Всплески"
              />
            </Field>
          </div>

          {(doubleAdv || doubleBane) && (
            <p className="abil-roll-warning">
              <Icon name="warning" size={15} />
              {doubleAdv
                ? "Двойное преимущество: итоговый тир повышается на 1."
                : "Двойная помеха: итоговый тир понижается на 1."}
            </p>
          )}
          {!isMain && (
            <p className="muted small">
              Способность не является основным действием — критическое попадание
              невозможно.
            </p>
          )}
        </div>

        <div className="abil-roll-result" aria-live="polite">
          {!result && (
            <div className="abil-roll-placeholder">
              <Icon name="dice" size={30} />
              <p className="muted">Настройте бросок и нажмите «Бросить»</p>
            </div>
          )}

          {result && (
            <>
              <div className="abil-roll-dice">
                <span className="abil-die mono">{result.die1}</span>
                <span className="abil-die mono">{result.die2}</span>
                <div className="abil-roll-nums">
                  <span className="small muted">
                    Натуральный <b className="mono">{result.natural}</b>
                  </span>
                  <span className="small muted">
                    {charLabel?.short} {character.characteristics[charKey]}
                    {bonus !== 0 &&
                      ` ${bonus > 0 ? "+" : "−"}${Math.abs(bonus)}`}
                    {result.edgeBonus !== 0 &&
                      ` ${result.edgeBonus > 0 ? "+" : "−"}${Math.abs(result.edgeBonus)}`}
                    {" = "}
                    <b className="mono">{result.total}</b>
                  </span>
                </div>
              </div>

              <div className="abil-roll-badges">
                <TierBadge tier={result.tier} size="lg" />
                {result.crit && (
                  <span className="abil-crit-badge">
                    Критическое попадание!
                  </span>
                )}
                {result.note && (
                  <span className="abil-note-badge">{result.note}</span>
                )}
              </div>

              <div className="abil-roll-outcome">
                {tier?.effect ? (
                  <RichText text={tier.effect} className="abil-tier-effect" />
                ) : (
                  <p className="muted small">У выбранного тира нет эффекта.</p>
                )}

                {tier && tier.damage && damage && (
                  <div className="abil-damage">
                    <div className="abil-damage-row">
                      <span className="abil-block-label">Урон</span>
                      <span
                        className="abil-damage-value mono"
                        title={tier.damage}
                      >
                        {damage.display}
                      </span>
                    </div>
                    {surges > 0 && (
                      <>
                        <div className="abil-damage-row">
                          <span className="abil-block-label">Всплески</span>
                          <span className="mono">
                            {surges} × {surgeOne} = +{surgeBonus}
                          </span>
                        </div>
                        <div className="abil-damage-row abil-damage-total">
                          <span className="abil-block-label">Итог</span>
                          <span className="mono">{surgeFinal.join(" / ")}</span>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
