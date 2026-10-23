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
  Modal,
  NumberInput,
  Stepper,
} from "../../components/ui";
import { preferredCharacteristic } from "../../lib/abilities";
import { abilityDistance } from "../../lib/character-calculations";
import {
  previewGameAction,
  undoReason,
  type GameAction,
} from "../../lib/game-actions";
import { heroicResourceName } from "../../data/classes";
import { makeId } from "../../data/templates";
import { actionLabel } from "../../data/actions";
import { Icon } from "../../components/Icons";
import { RichText } from "../../components/RichText";
import { TierBadge } from "../../components/TierBadge";
import { useApp } from "../../state/AppContext";
import "../../components/AbilityPresentation.css";
import "../AbilitiesView.css";
import "./RollModal.css";

export interface RollModalProps {
  ability: Ability;
  character: Character;
  onClose: () => void;
}

/** Rolls are previews. Only applying the action changes resources, once per operation. */
export function RollModal({ ability, character, onClose }: RollModalProps) {
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
    <Modal
      open
      onClose={onClose}
      className="abil-roll-modal"
      title={
        <span className="abil-roll-title">
          <Icon name="abilities" size={18} />
          {ability.name || "Без названия"}
        </span>
      }
      footer={
        <div className="abil-roll-footer">
          <Button variant="ghost" onClick={onClose}>
            Закрыть
          </Button>
          <span className="grow" />
          {!applied && (
            <span className="ability-use-cost small muted">
              Расход: {waiveCost ? 0 : ability.resourceCost + additionalCost} ·
              всплески: {canUseSurges ? surges : 0}
            </span>
          )}
          {applied ? (
            <>
              {canUndo && (
                <Button variant="ghost" onClick={undoGameAction}>
                  Отменить применение
                </Button>
              )}
              <Button variant="soft" onClick={newUse}>
                Новое применение
              </Button>
            </>
          ) : (
            <>
              {hasRoll && (
                <Button
                  variant={result ? "soft" : "primary"}
                  icon="dice"
                  onClick={roll}
                >
                  {source === "physical"
                    ? "Рассчитать"
                    : result
                      ? "Перебросить"
                      : "Бросить 2d10"}
                </Button>
              )}
              <Button
                variant="primary"
                onClick={apply}
                disabled={(hasRoll && !result) || !preview.ok}
              >
                Применить
              </Button>
            </>
          )}
        </div>
      }
    >
      <div className="ability-use-facts small muted">
        <span>{actionLabel(ability.actionType)}</span>
        <span>{abilityDistance(ability, character)}</span>
        <span>{ability.target}</span>
      </div>
      {ability.trigger && (
        <div className="ability-use-trigger">
          <strong>Триггер</strong>
          <RichText text={ability.trigger} />
        </div>
      )}
      <div className="abil-roll-layout">
        <fieldset
          className="abil-roll-settings ability-use-settings"
          disabled={applied}
        >
          <legend className="sr-only">Параметры применения способности</legend>
          {hasRoll && (
            <>
              <div
                className="abil-chips"
                role="group"
                aria-label="Источник броска"
              >
                <Chip
                  active={source === "digital"}
                  onClick={() => {
                    setSource("digital");
                    setDice(null);
                  }}
                >
                  В приложении
                </Chip>
                <Chip
                  active={source === "physical"}
                  onClick={() => {
                    setSource("physical");
                    setDice(null);
                  }}
                >
                  Свои кубики
                </Chip>
              </div>
              {source === "physical" && (
                <div className="abil-roll-grid">
                  {[0, 1].map((index) => (
                    <Field
                      key={index}
                      label={"Кубик " + (index + 1) + " (d10)"}
                    >
                      <NumberInput
                        value={manualDice[index]}
                        min={1}
                        max={10}
                        label={"Кубик " + (index + 1)}
                        onChange={(value) => {
                          setManualDice((previous) =>
                            index === 0
                              ? [value, previous[1]]
                              : [previous[0], value],
                          );
                          setDice(null);
                        }}
                      />
                    </Field>
                  ))}
                </div>
              )}
              <div className="field">
                <span className="field-label">Характеристика</span>
                <div className="abil-chips">
                  {characteristics.map((key) => (
                    <Chip
                      key={key}
                      active={charKey === key}
                      onClick={() => setCharKey(key)}
                      title={
                        CHARACTERISTICS.find((item) => item.key === key)?.label
                      }
                    >
                      {CHARACTERISTICS.find((item) => item.key === key)?.short}{" "}
                      {character.characteristics[key]}
                    </Chip>
                  ))}
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
                {canUseSurges && (
                  <Field
                    label={"Всплески к урону · доступно " + character.surges}
                  >
                    <Stepper
                      value={surges}
                      onChange={setSurges}
                      min={0}
                      max={Math.min(3, character.surges)}
                      label="Всплески для способности"
                    />
                  </Field>
                )}
              </div>
              {ability.keywords.includes("Ближний") &&
                ability.keywords.includes("Дальний") && (
                  <div
                    className="abil-chips"
                    role="group"
                    aria-label="Способ атаки"
                  >
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
            </>
          )}
          <p className="small muted">
            {resourceName}: {character.heroicResource.current}. Стоимость:{" "}
            {ability.resourceCost}.
          </p>
          <details className="ability-use-notes">
            <summary>Дополнительный расход</summary>
            <Field label={`Дополнительно потратить: ${resourceName}`}>
              <NumberInput
                value={additionalCost}
                onChange={setAdditionalCost}
                min={0}
                max={9999}
                label="Дополнительный расход ресурса"
              />
            </Field>
            <p className="small muted">
              Для усилений и других расходов из текста способности.
            </p>
          </details>
          {(ability.resourceCost > 0 || additionalCost > 0) && (
            <label className="ability-use-exception">
              <input
                type="checkbox"
                checked={waiveCost}
                onChange={(event) => setWaiveCost(event.target.checked)}
              />
              Без расхода ресурса (исключение)
            </label>
          )}
        </fieldset>
        <div className="abil-roll-result" aria-live="polite">
          {!hasRoll ? (
            <p className="muted">Способность применяется без броска.</p>
          ) : !result ? (
            <div className="abil-roll-placeholder">
              <Icon name="dice" size={30} />
              <p className="muted">
                {source === "physical"
                  ? "Введите оба d10 и нажмите «Рассчитать»"
                  : "Настройте бросок и бросьте 2d10"}
              </p>
            </div>
          ) : (
            <>
              <div className="abil-roll-dice">
                <span className="abil-die mono">{result.die1}</span>
                <span className="abil-die mono">{result.die2}</span>
                <div className="abil-roll-nums">
                  <span className="small muted">
                    Натуральный: {result.natural}
                  </span>
                  <strong className="mono">Итог: {result.total}</strong>
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
                {damage && (
                  <div className="abil-damage">
                    <div className="abil-damage-row">
                      <span className="abil-block-label">Урон</span>
                      <strong
                        className="abil-damage-value mono"
                        title={tier?.damage}
                      >
                        {surgeFinal}
                      </strong>
                    </div>
                    {surges > 0 && (
                      <p className="small muted">
                        Включено {surges} × {surgeDamage(character)} = +
                        {surgeBonus} от всплесков.
                      </p>
                    )}
                  </div>
                )}
                {tier?.effect && (
                  <RichText text={tier.effect} className="abil-tier-effect" />
                )}
              </div>
            </>
          )}
        </div>
      </div>
      <div
        className={"ability-use-preview " + (applied ? "is-applied" : "")}
        role="status"
      >
        <strong>
          {isUndone
            ? "Применение отменено"
            : applied
              ? "Применено"
              : "Изменения на листе"}
        </strong>
        <p>
          {applied ? receipt : preview.ok ? preview.detail : preview.reason}
        </p>
        {!applied && (
          <p className="small muted">
            {hasRoll ? "Бросок не расходует ресурсы. " : ""}Расход
            подтверждается кнопкой «Применить». Эффект на цель разрешается за
            игровым столом.
          </p>
        )}
      </div>
      {ability.effect && (
        <div className="ability-use-effect">
          <span className="eyebrow">Эффект</span>
          <RichText text={ability.effect} />
        </div>
      )}
      {ability.notes && (
        <details className="ability-use-notes">
          <summary>Заметки к способности</summary>
          <RichText text={ability.notes} />
        </details>
      )}
    </Modal>
  );
}
