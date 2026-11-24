import { useLocale } from "../../i18n/locale";
import { Icon } from "../../components/Icons";
import { useEffect, useState } from "react";
import { Panel, TextInput } from "../../components/ui";
import { clamp, vitalStatus } from "../../lib/rules";
import { characterStatBreakdown } from "../../lib/character-calculations";
import { useApp } from "../../state/AppContext";
import { HealthControls, RecoveriesReadout } from "./HealthControls";
import { DamageTraits } from "./DamageTraits";
import { StatBreakdown } from "./StatBreakdown";

/** Здоровье: выносливость, урон, восстановления и отдых. */
export function VitalsPanel() {
  const { t } = useLocale();
  const { character, derived, patch, performGameAction, readOnly } = useApp();
  const [maxDraft, setMaxDraft] = useState(String(character.stamina.max));

  useEffect(
    () => setMaxDraft(String(character.stamina.max)),
    [character.stamina.max],
  );

  const commitMax = (value?: number) => {
    const parsed = value ?? Number(maxDraft);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setMaxDraft(String(character.stamina.max));
      return;
    }
    const nextMax = Math.min(999, Math.max(0, Math.floor(parsed)));
    patch({
      stamina: {
        ...character.stamina,
        max: nextMax,
        current: Math.min(character.stamina.current, nextMax),
      },
    });
    setMaxDraft(String(nextMax));
  };

  const status = vitalStatus(character);
  const stamina = character.stamina;
  const max = Math.max(0, stamina.max);
  const winded = derived.winded;
  const fillPct = max > 0 ? clamp((stamina.current / max) * 100, 0, 100) : 0;
  const negPct =
    max > 0 && stamina.current < 0
      ? clamp((-stamina.current / max) * 100, 0, 100)
      : 0;
  const tempPct =
    max > 0 ? clamp((stamina.temp / max) * 100, 0, 100 - fillPct) : 0;
  const currentClass = `vital-big numeric${stamina.current <= 0 ? " is-down" : ""}`;

  return (
    <Panel
      title={t("Здоровье", "Health")}
      icon="heart"
      className="vitals-panel"
      actions={
        <>
          <DamageTraits />
          <span className={`status-chip tone-${status.tone}`}>
            {t(status.label, ({ normal: "Ready", winded: "Winded", dying: "Dying", dead: "Dead" } as const)[status.tone])}
          </span>
        </>
      }
    >
      <div className="vitals-head">
        <RecoveriesReadout />
        <div className="vitals-current">
          {readOnly ? (
            <span className={currentClass}>{stamina.current}</span>
          ) : (
            <input
              className={`${currentClass} vital-current-input`}
              inputMode="numeric"
              aria-label={t("Текущая выносливость (исправить значение)", "Current stamina (edit)")}
              title={t("Нажмите, чтобы исправить текущее значение", "Click to edit the current value")}
              key={stamina.current}
              defaultValue={stamina.current}
              onFocus={(event) => event.currentTarget.select()}
              onBlur={(event) => {
                const next = Number(event.currentTarget.value);
                if (
                  event.currentTarget.value.trim() === "" ||
                  !Number.isInteger(next) ||
                  next === stamina.current
                ) {
                  event.currentTarget.value = String(stamina.current);
                  return;
                }
                if (!performGameAction({ kind: "adjust", amount: next }))
                  event.currentTarget.value = String(stamina.current);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
                if (event.key === "Escape") {
                  event.currentTarget.value = String(stamina.current);
                  event.currentTarget.blur();
                }
              }}
            />
          )}
          <span
            className="vital-max-edit"
            title={readOnly ? undefined : t("Максимум выносливости — измените и нажмите Enter", "Edit maximum stamina and press Enter")}
          >
            <span className="vital-max-slash numeric">/</span>
            {readOnly ? (
              <span className="numeric">{stamina.max}</span>
            ) : (
              <TextInput
                value={maxDraft}
                inputMode="numeric"
                aria-label={t("Максимум выносливости", "Maximum stamina")}
                className="vital-max-input number-counter-plain numeric"
                onChange={(event) => setMaxDraft(event.target.value)}
                onFocus={(event) => event.currentTarget.select()}
                onBlur={(event) => {
                  const value = event.currentTarget.value.trim();
                  if (value === "") setMaxDraft(String(character.stamina.max));
                  else commitMax(Number(value));
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    event.currentTarget.blur();
                  }
                  if (event.key === "Escape") {
                    event.currentTarget.value = String(character.stamina.max);
                    setMaxDraft(String(character.stamina.max));
                    event.currentTarget.blur();
                  }
                }}
              />
            )}
            {character.automation?.enabled && (
              <StatBreakdown
                label={t("максимума выносливости", "maximum Stamina")}
                breakdown={characterStatBreakdown(character, "stamina")}
              />
            )}
          </span>
          {stamina.temp > 0 && (readOnly ? (
            <span className="vital-temp mono">+{stamina.temp} {t("врем.", "temp.")}</span>
          ) : (
            <button
              type="button"
              className="vital-temp mono vital-temp-clear"
              title={t("Сбросить временную выносливость", "Clear temporary Stamina")}
              aria-label={t(`Временная выносливость ${stamina.temp}: сбросить`, `Clear ${stamina.temp} temporary Stamina`)}
              onClick={() => patch({ stamina: { ...stamina, temp: 0 } })}
            >
              +{stamina.temp} {t("врем.", "temp.")} <Icon name="close" size={12} />
            </button>
          ))}
        </div>
      </div>

      <div
        className="meter"
        role="img"
        aria-label={t(`Выносливость: ${stamina.current} из ${max}, временная ${stamina.temp}`, `Stamina: ${stamina.current} of ${max}, temporary ${stamina.temp}`)}
      >
        <span
          className={`meter-fill tone-${status.tone}`}
          style={{ width: `${fillPct}%` }}
        />
        {negPct > 0 && (
          <span className="meter-negative" style={{ width: `${negPct}%` }} />
        )}
        {max > 0 && stamina.temp > 0 && (
          <span
            className="meter-temp"
            style={{ left: `${fillPct}%`, width: `${tempPct}%` }}
          />
        )}
        {max > 0 && (
          <span
            className="meter-tick"
            style={{ left: "50%" }}
            title={t(`Порог утомления: ${winded}`, `Winded threshold: ${winded}`)}
          />
        )}
      </div>

      {!readOnly && <HealthControls />}
    </Panel>
  );
}
