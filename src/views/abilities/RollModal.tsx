import { englishCalculation } from "../../i18n/ability-messages";
import { usePrintedAbility } from "../../components/rules/usePrintedAbility";
import { useLocale } from "../../i18n/locale";
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
import { abilityRollBreakdown, preferredCharacteristic } from "../../lib/abilities";
import { effectiveCharacteristics } from "../../lib/feature-modifiers";
import { CalculationInline } from "../../components/rules/CalculationInline";
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
  showCalculations?: boolean;
  language?: "ru" | "en";
  printedAbilityId?: string;
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
export function AbilityRollPanel({ ability, character, showCalculations = false, language, printedAbilityId }: AbilityRollPanelProps) {
  const context = useLocale();
  const locale = language ?? context.locale;
  const t = (ru: string, en: string) => locale === "en" ? en : ru;
  const { card } = usePrintedAbility(printedAbilityId ?? ability.id);
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
  const [bonus, setBonus] = useState(0);
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
    !undoReason(character, appliedEntry, locale);
  const effective = effectiveCharacteristics(character);
  const rollCalculation = abilityRollBreakdown(ability, character, {
    characteristic: charKey,
    additionalBonus: bonus,
    edges,
    banes,
  });
  const characteristicBonus = rollCalculation?.characteristicBonus ?? effective[charKey];

  const result = useMemo(
    () =>
      dice
        ? rollPowerRoll({
            dice,
            characteristic: characteristicBonus,
            edges,
            banes,
            bonus: ability.rollBonus + bonus,
            isMainAction: ability.actionType === "main",
          })
        : null,
    [
      dice,
      characteristicBonus,
      edges,
      banes,
      bonus,
      ability.actionType,
      ability.rollBonus,
    ],
  );
  const tier = result ? ability.tiers[result.tier - 1] : null;
  const damage =
    tier?.damage && result
      ? evaluateAbilityDamage(
          { ...ability, weaponMode },
          result.tier,
          character,
          surges,
          locale === "en",
        )
      : null;
  const surgeBonus = surgeDamageTotal(character, surges);
  const surgeFinal = locale === "en" ? damage?.englishDisplay ?? damage?.display : damage?.display;
  const printedTier = result && locale === "en" ? card?.roll?.tiers[result.tier - 1] : undefined;
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
        (damage ? " Урон: " + damage.display + "." : "")
      : hasRoll
        ? undefined
        : "Без броска.",
  };
  const preview = previewGameAction(character, action, locale);
  const rawResourceName = heroicResourceName(character.className);
  const resourceName = t(rawResourceName, ({ "Героический ресурс": "Heroic resource", "Свирепость": "Ferocity", "Дисциплина": "Discipline", "Эссенция": "Essence", "Благочестие": "Piety", "Фокус": "Focus", "Ясность": "Clarity", "Прозрение": "Insight", "Драма": "Drama", "Гнев": "Wrath" } as Record<string, string>)[rawResourceName] || rawResourceName);
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
    <section className="ability-roll-panel" aria-label={hasRoll ? t("Бросок силы", "Power roll") : t("Применение способности", "Use ability")}>
      <header className="ability-roll-header">
        <h3 className="ability-roll-heading">{hasRoll ? t("Бросок силы", "Power roll") : t("Применение", "Use")}</h3>
        {rollCalculation && <strong className="ability-roll-bonus">{rollCalculation.total}</strong>}
        <span className="ability-roll-resource">
          {resourceName}: {character.heroicResource.current} · {t("расход", "cost")} {waiveCost ? 0 : ability.resourceCost + additionalCost}
        </span>
      </header>

      {showCalculations && rollCalculation && <CalculationInline language={locale} calculations={[locale === "en" ? englishCalculation(rollCalculation) : rollCalculation]} base="2d10" />}

      <fieldset className="ability-use-settings" disabled={applied}>
        <legend className="sr-only">{t("Параметры применения способности", "Ability use settings")}</legend>
        {hasRoll && (
          <>
            <div className="ability-roll-choices">
              <div className="ability-roll-choice">
                <span className="field-label">{t("Кубики", "Dice")}</span>
                <div className="ability-roll-source">
                  <Toggle
                    checked={source === "digital"}
                    label={t("Бросок в приложении", "Roll in app")}
                    onChange={(digital) => {
                      setSource(digital ? "digital" : "physical");
                      setDice(null);
                    }}
                  />
                  <span>{source === "digital" ? t("В приложении", "In app") : t("Вручную", "Manual")}</span>
                </div>
              </div>
              {characteristics.length > 1 && (
                <div className="ability-roll-choice">
                  <span className="field-label">{t("Характеристика", "Characteristic")}</span>
                  <div className="abil-chips" role="group" aria-label={t("Характеристика броска", "Roll characteristic")}>
                    {characteristics.map((key) => (
                      <Chip
                        key={key}
                        active={charKey === key}
                        onClick={() => setCharKey(key)}
                        title={locale === "en" ? ({ might: "Might", agility: "Agility", reason: "Reason", intuition: "Intuition", presence: "Presence" } as const)[key] : CHARACTERISTICS.find((item) => item.key === key)?.label}
                      >
                        <CharacteristicGlyph characteristic={key} language={locale} />
                        {effective[key]}
                      </Chip>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {source === "physical" && (
              <div className="ability-roll-dice-inputs">
                {[0, 1].map((index) => (
                  <Field key={index} label={t(`Кубик ${index + 1} (d10)`, `Die ${index + 1} (d10)`)}>
                    <NumberInput
                      value={manualDice[index]}
                      min={1}
                      max={10}
                      label={t(`Кубик ${index + 1}`, `Die ${index + 1}`)}
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
              <RollMarks label={t("Преимущества", "Edges")} one={t("одно преимущество", "one edge")} two={t("два преимущества", "two edges")} value={edges} onChange={setEdges} tone="advantage" />
              <RollMarks label={t("Помехи", "Banes")} one={t("одна помеха", "one bane")} two={t("две помехи", "two banes")} value={banes} onChange={setBanes} tone="bane" />
            </div>

            <div className="ability-roll-numbers">
              <Field label={t("Бонус к броску", "Roll bonus")}>
                <NumberInput value={bonus} onChange={setBonus} min={-10} max={20} label={t("Дополнительный бонус броска", "Additional roll bonus")} />
                <span className="small muted">{t("Дополнительно к характеристике и бонусу способности.", "Added to the characteristic and ability bonus.")}</span>
              </Field>
              {canDealDamage && (
                <fieldset className="ability-roll-surge" disabled={!canUseSurges} title={!canUseSurges ? t("Всплески доступны после результата с уроном", "Surges are available after a damaging result") : undefined}>
                  <legend className="sr-only">{t("Всплески к урону", "Surges for damage")}</legend>
                  <Field label={t(`Всплески · ${character.surges}`, `Surges · ${character.surges}`)}>
                    <Stepper value={canUseSurges ? surges : 0} onChange={setSurges} min={0} max={Math.min(3, character.surges)} label={t("Всплески для способности", "Surges for ability")} />
                  </Field>
                </fieldset>
              )}
            </div>
            {ability.keywords.includes("Ближний") && ability.keywords.includes("Дальний") && (
              <div className="ability-roll-choice">
                <span className="field-label">{t("Способ атаки", "Attack mode")}</span>
                <div className="abil-chips" role="group" aria-label={t("Способ атаки", "Attack mode")}>
                  <Chip active={weaponMode === "melee"} onClick={() => setWeaponMode("melee")}>{t("Ближний бой", "Melee")}</Chip>
                  <Chip active={weaponMode === "ranged"} onClick={() => setWeaponMode("ranged")}>{t("Дальний бой", "Ranged")}</Chip>
                </div>
              </div>
            )}
          </>
        )}

        <section className="ability-use-notes">
          <h3>{t("Дополнительный расход", "Additional cost")}</h3>
          <Field label={t(`Дополнительно потратить: ${resourceName}`, `Additional ${resourceName} to spend`)}>
            <NumberInput value={additionalCost} onChange={setAdditionalCost} min={0} max={9999} label={t("Дополнительный расход ресурса", "Additional resource cost")} />
          </Field>
          <p className="small muted">{t("Для усилений и других расходов из текста способности.", "For enhancements and other costs in the ability text.")}</p>
          {(ability.resourceCost > 0 || additionalCost > 0) && (
            <label className="ability-use-exception">
              <input type="checkbox" checked={waiveCost} onChange={(event) => setWaiveCost(event.target.checked)} />
              {t("Без расхода ресурса (исключение)", "Waive resource cost (exception)")}
            </label>
          )}
        </section>
      </fieldset>

      {(result || !hasRoll) && (
        <div className="abil-roll-result" aria-live="polite" data-tier={result?.tier} title={result ? t(`Тир ${result.tier}`, `Tier ${result.tier}`) : undefined}>
          {!hasRoll ? (
            <p className="muted">{t("Способность применяется без броска.", "This ability is used without a roll.")}</p>
          ) : result && (
            <>
              <div className="abil-roll-dice">
                <span className="abil-die mono">{result.die1}</span>
                <span className="abil-die mono">{result.die2}</span>
                <div className="abil-roll-nums">
                  <span className="small muted">{t("Натуральный", "Natural")}: {result.natural}</span>
                  <strong className="mono">{t("Итог", "Total")}: {result.total}</strong>
                </div>
                <span className="sr-only">{t(`Тир ${result.tier}`, `Tier ${result.tier}`)}</span>
              </div>
              {(result.crit || result.note) && (
                <div className="abil-roll-badges">
                  {result.crit && <span className="abil-crit-badge">{t("Критическое попадание!", "Critical hit!")}</span>}
                  {result.note && <span className="abil-note-badge">{locale === "en" ? ({ "Двойное преимущество: +1 тир": "Double edge: +1 tier", "Двойная помеха: −1 тир": "Double bane: −1 tier", "Преимущество: +2": "Edge: +2", "Помеха: −2": "Bane: −2" } as Record<string, string>)[result.note] ?? result.note : result.note}</span>}
                </div>
              )}
              <div className="abil-roll-outcome">
                {damage && (
                  <div className="abil-damage">
                    <div className="abil-damage-row">
                      <span className="abil-block-label">{t("Урон", "Damage")}</span>
                      <strong className="abil-damage-value mono" title={printedTier?.damage?.value ?? tier?.damage}>{surgeFinal}</strong>
                    </div>
                    {surges > 0 && (
                      <p className="small muted">{t(`Включено ${surges} × ${surgeDamage(character)} = +${surgeBonus} от всплесков.`, `Includes ${surges} × ${surgeDamage(character)} = +${surgeBonus} from surges.`)}</p>
                    )}
                    {showCalculations && <CalculationInline language={locale} calculations={locale === "en" ? (damage.calculations ?? []).map(calc => ({ ...englishCalculation(calc), englishFormula: printedTier?.damage?.value })) : damage.calculations ?? []} />}
                  </div>
                )}
                {(printedTier?.effect ?? tier?.effect) && <RichText characteristicGlyphs={locale === "ru"} text={printedTier?.effect ?? tier!.effect} className="abil-tier-effect" />}
              </div>
            </>
          )}
        </div>
      )}

      {(applied || !preview.ok) && (
        <div className={"ability-use-preview " + (applied ? "is-applied" : "")} role="status">
          <strong>{isUndone ? t("Применение отменено", "Use undone") : applied ? t("Применено", "Applied") : t("Нельзя применить", "Cannot apply")}</strong>
          <p>{applied ? receipt : preview.ok ? preview.detail : preview.reason}</p>
        </div>
      )}
      {!applied && (ability.resourceCost + additionalCost > 0 || surges > 0) && (
        <p className="ability-roll-hint">{t("Ресурсы спишутся после нажатия «Применить».", "Resources are spent after selecting Apply.")}</p>
      )}

      <div className="abil-roll-footer">
        {applied ? (
          <>
            {canUndo && <Button variant="ghost" onClick={undoGameAction}>{t("Отменить применение", "Undo use")}</Button>}
            <Button variant="soft" onClick={newUse}>{t("Новое применение", "New use")}</Button>
          </>
        ) : (
          <>
            {hasRoll && (
              <Button
                variant={result ? "soft" : "primary"}
                icon={source === "digital" && result ? "refresh" : "dice"}
                iconOnly={source === "digital" && !!result}
                aria-label={source === "digital" && result ? t("Перебросить 2d10", "Reroll 2d10") : undefined}
                title={source === "digital" && result ? t("Перебросить 2d10", "Reroll 2d10") : undefined}
                onClick={roll}
              >
                {source === "physical" ? t("Рассчитать", "Calculate") : t("Бросить 2d10", "Roll 2d10")}
              </Button>
            )}
            <Button variant="primary" onClick={apply} disabled={(hasRoll && !result) || !preview.ok}>
              {t("Применить", "Apply")}
            </Button>
          </>
        )}
      </div>


    </section>
  );
}
