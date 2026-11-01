import { useMemo, useRef, useState } from "react";
import type { Ability, Character, CharacteristicKey } from "../../types";
import {
  CHARACTERISTICS,
  evaluateAbilityDamage,
  rollPowerRoll,
  surgeDamage,
  surgeDamageTotal,
} from "../../lib/rules";
import {
  Button,
  Chip,
  Field,
  NumberInput,
  Stepper,
  Toggle,
} from "../../components/ui";
import { preferredCharacteristic } from "../../lib/abilities";
import {
  previewGameAction,
  undoReason,
  type GameAction,
} from "../../lib/game-actions";
import { heroicResourceName } from "../../data/classes";
import { makeId } from "../../data/templates";
import { RichText } from "../../components/RichText";
import { CharacteristicGlyph } from "../../components/CharacteristicGlyph";
import { useApp } from "../../state/AppContext";
import "../../components/AbilityPresentation.css";
import "../AbilitiesView.css";
import "./RollModal.css";

export interface AbilityRollPanelProps {
  ability: Ability;
  character: Character;
}

function RollMarks({
  label,
  one,
  two,
  value,
  onChange,
  tone,
}: {
  label: string;
  one: string;
  two: string;
  value: number;
  onChange: (value: number) => void;
  tone: "advantage" | "bane";
}) {
  return (
    <div className="ability-roll-choice">
      <span className="field-label">{label}</span>
      <div className="ability-roll-marks" role="group" aria-label={label} data-tone={tone}>
        {([1, 2] as const).map((amount) => (
          <button
            key={amount}
            type="button"
            className="ability-roll-mark"
            aria-label={`${label}: ${amount === 1 ? one : two}`}
            aria-pressed={value >= amount}
            title={amount === 1 ? one : two}
            onClick={() => onChange(value === amount ? 0 : amount)}
          />
        ))}
      </div>
    </div>
  );
}

/** Rolls are previews. Only applying the action changes resources, once per operation. */
export function AbilityRollPanel({ ability, character }: AbilityRollPanelProps) {
  const { performGameAction, undoGameAction, gameHistory } = useApp();
  const characteristics = ability.rollCharacteristics;
  const hasRoll = characteristics.length > 0;
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
  const [additionalCost, setAdditionalCost] = useState(0);
  const [waiveCost, setWaiveCost] = useState(false);
  const [weaponMode, setWeaponMode] = useState<"melee" | "ranged">(
    ability.weaponMode ?? "melee",
  );
  const [source, setSource] = useState<"digital" | "physical">("digital");
  const [manualDice, setManualDice] = useState<[number, number]>([1, 1]);
  const [dice, setDice] = useState<readonly [number, number] | null>(null);
  const [applied, setApplied] = useState(false);
  const [receipt, setReceipt] = useState("");
  const operationId = useRef(makeId());
  const appliedRef = useRef(false);
  const appliedEntry = gameHistory.find(
    (entry) => entry.id === operationId.current,
  );
  const isUndone = appliedEntry?.undone ?? false;
  const canUndo =
    appliedEntry &&
    !isUndone &&
    gameHistory.find((entry) => !entry.undone)?.id === appliedEntry.id &&
    !undoReason(character, appliedEntry);

  const result = useMemo(
    () =>
      dice
        ? rollPowerRoll({
            dice,
            characteristic: character.characteristics[charKey],
            edges,
            banes,
            bonus,
            isMainAction: ability.actionType === "main",
          })
        : null,
    [
      dice,
      character.characteristics,
      charKey,
      edges,
      banes,
      bonus,
      ability.actionType,
    ],
  );
  const tier = result ? ability.tiers[result.tier - 1] : null;
  const damage =
    tier?.damage && result
      ? evaluateAbilityDamage(
          { ...ability, weaponMode },
          result.tier,
          character,
        )
      : null;
  const surgeBonus = surgeDamageTotal(character, surges);
  const surgeFinal =
    damage && surges > 0
      ? damage.dice.length > 0
        ? damage.display + " + " + surgeBonus
        : [...new Set(damage.values.map((value) => value + surgeBonus))].join(
            " / ",
          )
      : damage?.display;
  const canUseSurges = Boolean(damage);
  const canDealDamage = hasRoll && ability.tiers.some((item) => item.damage.trim() !== "");
  const action: GameAction = {
    kind: "ability",
    abilityId: ability.id,
    surges: canUseSurges ? surges : 0,
    additionalCost,
    waiveCost,
    result: result
      ? "2d10: " +
        result.die1 +
        " + " +
        result.die2 +
        "; итог " +
        result.total +
        ", тир " +
        result.tier +
        "." +
        (damage ? " Урон: " + surgeFinal + "." : "")
      : hasRoll
        ? undefined
        : "Без броска.",
  };
  const preview = previewGameAction(character, action);
  const resourceName = heroicResourceName(character.className);
  const roll = () => {
    if (appliedRef.current) return;
    if (source === "physical") setDice([...manualDice]);
    else {
      const rolled = rollPowerRoll({ characteristic: 0 });
      setDice([rolled.die1, rolled.die2]);
    }
  };
  const apply = () => {
    if (appliedRef.current || (hasRoll && !result) || !preview.ok) return;
    if (performGameAction(action, operationId.current)) {
      appliedRef.current = true;
      setApplied(true);
      setReceipt(preview.detail);
    }
  };
  const newUse = () => {
    operationId.current = makeId();
    appliedRef.current = false;
    setApplied(false);
    setReceipt("");
    setDice(null);
    setSurges(0);
    setAdditionalCost(0);
    setWaiveCost(false);
  };

  return (
    <section className="ability-roll-panel" aria-label={hasRoll ? "Бросок силы" : "Применение способности"}>
      <header className="ability-roll-header">
        <h3 className="ability-roll-heading">{hasRoll ? "Бросок силы" : "Применение"}</h3>
        <span className="ability-roll-resource">
          {resourceName}: {character.heroicResource.current} · расход {waiveCost ? 0 : ability.resourceCost + additionalCost}
        </span>
      </header>

      <fieldset className="ability-use-settings" disabled={applied}>
        <legend className="sr-only">Параметры применения способности</legend>
        {hasRoll && (
          <>
            <div className="ability-roll-choices">
              <div className="ability-roll-choice">
                <span className="field-label">Кубики</span>
                <div className="ability-roll-source">
                  <Toggle
                    checked={source === "digital"}
                    label="Бросок в приложении"
                    onChange={(digital) => {
                      setSource(digital ? "digital" : "physical");
                      setDice(null);
                    }}
                  />
                  <span>{source === "digital" ? "В приложении" : "Вручную"}</span>
                </div>
              </div>
              {characteristics.length > 1 && (
                <div className="ability-roll-choice">
                  <span className="field-label">Характеристика</span>
                  <div className="abil-chips" role="group" aria-label="Характеристика броска">
                    {characteristics.map((key) => (
                      <Chip
                        key={key}
                        active={charKey === key}
                        onClick={() => setCharKey(key)}
                        title={CHARACTERISTICS.find((item) => item.key === key)?.label}
                      >
                        <CharacteristicGlyph characteristic={key} />
                        {character.characteristics[key]}
                      </Chip>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {source === "physical" && (
              <div className="ability-roll-dice-inputs">
                {[0, 1].map((index) => (
                  <Field key={index} label={"Кубик " + (index + 1) + " (d10)"}>
                    <NumberInput
                      value={manualDice[index]}
                      min={1}
                      max={10}
                      label={"Кубик " + (index + 1)}
                      onChange={(value) => {
                        setManualDice((previous) => index === 0 ? [value, previous[1]] : [previous[0], value]);
                        setDice(null);
                      }}
                    />
                  </Field>
                ))}
              </div>
            )}

            <div className="ability-roll-modifiers">
              <RollMarks label="Преимущества" one="одно преимущество" two="два преимущества" value={edges} onChange={setEdges} tone="advantage" />
              <RollMarks label="Помехи" one="одна помеха" two="две помехи" value={banes} onChange={setBanes} tone="bane" />
            </div>

            <div className="ability-roll-numbers">
              <Field label="Бонус к броску">
                <NumberInput value={bonus} onChange={setBonus} min={-10} max={20} label="Бонус броска" />
              </Field>
              {canDealDamage && (
                <fieldset className="ability-roll-surge" disabled={!canUseSurges} title={!canUseSurges ? "Всплески доступны после результата с уроном" : undefined}>
                  <legend className="sr-only">Всплески к урону</legend>
                  <Field label={`Всплески · ${character.surges}`}>
                    <Stepper value={canUseSurges ? surges : 0} onChange={setSurges} min={0} max={Math.min(3, character.surges)} label="Всплески для способности" />
                  </Field>
                </fieldset>
              )}
            </div>
            {ability.keywords.includes("Ближний") && ability.keywords.includes("Дальний") && (
              <div className="ability-roll-choice">
                <span className="field-label">Способ атаки</span>
                <div className="abil-chips" role="group" aria-label="Способ атаки">
                  <Chip active={weaponMode === "melee"} onClick={() => setWeaponMode("melee")}>Ближний бой</Chip>
                  <Chip active={weaponMode === "ranged"} onClick={() => setWeaponMode("ranged")}>Дальний бой</Chip>
                </div>
              </div>
            )}
          </>
        )}

        <details className="ability-use-notes">
          <summary>Дополнительный расход</summary>
          <Field label={`Дополнительно потратить: ${resourceName}`}>
            <NumberInput value={additionalCost} onChange={setAdditionalCost} min={0} max={9999} label="Дополнительный расход ресурса" />
          </Field>
          <p className="small muted">Для усилений и других расходов из текста способности.</p>
          {(ability.resourceCost > 0 || additionalCost > 0) && (
            <label className="ability-use-exception">
              <input type="checkbox" checked={waiveCost} onChange={(event) => setWaiveCost(event.target.checked)} />
              Без расхода ресурса (исключение)
            </label>
          )}
        </details>
      </fieldset>

      {(result || !hasRoll) && (
        <div className="abil-roll-result" aria-live="polite" data-tier={result?.tier} title={result ? `Тир ${result.tier}` : undefined}>
          {!hasRoll ? (
            <p className="muted">Способность применяется без броска.</p>
          ) : result && (
            <>
              <div className="abil-roll-dice">
                <span className="abil-die mono">{result.die1}</span>
                <span className="abil-die mono">{result.die2}</span>
                <div className="abil-roll-nums">
                  <span className="small muted">Натуральный: {result.natural}</span>
                  <strong className="mono">Итог: {result.total}</strong>
                </div>
                <span className="sr-only">Тир {result.tier}</span>
              </div>
              {(result.crit || result.note) && (
                <div className="abil-roll-badges">
                  {result.crit && <span className="abil-crit-badge">Критическое попадание!</span>}
                  {result.note && <span className="abil-note-badge">{result.note}</span>}
                </div>
              )}
              <div className="abil-roll-outcome">
                {damage && (
                  <div className="abil-damage">
                    <div className="abil-damage-row">
                      <span className="abil-block-label">Урон</span>
                      <strong className="abil-damage-value mono" title={tier?.damage}>{surgeFinal}</strong>
                    </div>
                    {surges > 0 && (
                      <p className="small muted">Включено {surges} × {surgeDamage(character)} = +{surgeBonus} от всплесков.</p>
                    )}
                  </div>
                )}
                {tier?.effect && <RichText characteristicGlyphs text={tier.effect} className="abil-tier-effect" />}
              </div>
            </>
          )}
        </div>
      )}

      {(applied || !preview.ok) && (
        <div className={"ability-use-preview " + (applied ? "is-applied" : "")} role="status">
          <strong>{isUndone ? "Применение отменено" : applied ? "Применено" : "Нельзя применить"}</strong>
          <p>{applied ? receipt : preview.ok ? preview.detail : preview.reason}</p>
        </div>
      )}
      {!applied && (ability.resourceCost + additionalCost > 0 || surges > 0) && (
        <p className="ability-roll-hint">Ресурсы спишутся после нажатия «Применить».</p>
      )}

      <div className="abil-roll-footer">
        {applied ? (
          <>
            {canUndo && <Button variant="ghost" onClick={undoGameAction}>Отменить применение</Button>}
            <Button variant="soft" onClick={newUse}>Новое применение</Button>
          </>
        ) : (
          <>
            {hasRoll && (
              <Button
                variant={result ? "soft" : "primary"}
                icon={source === "digital" && result ? "refresh" : "dice"}
                iconOnly={source === "digital" && !!result}
                aria-label={source === "digital" && result ? "Перебросить 2d10" : undefined}
                title={source === "digital" && result ? "Перебросить 2d10" : undefined}
                onClick={roll}
              >
                {source === "physical" ? "Рассчитать" : "Бросить 2d10"}
              </Button>
            )}
            <Button variant="primary" onClick={apply} disabled={(hasRoll && !result) || !preview.ok}>
              Применить
            </Button>
          </>
        )}
      </div>


    </section>
  );
}
