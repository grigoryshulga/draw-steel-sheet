import { useEffect, useState } from "react";
import { NumberInput, Panel } from "../../components/ui";
import { clamp, vitalStatus } from "../../lib/rules";
import { characterStatBreakdown } from "../../lib/character-calculations";
import { useApp } from "../../state/AppContext";
import { HealthControls, RecoveriesReadout } from "./HealthControls";
import { StatBreakdown } from "./StatBreakdown";

/** Здоровье: выносливость, урон, восстановления и отдых. */
export function VitalsPanel() {
  const { character, derived, patch, performGameAction } = useApp();
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

  return (
    <Panel
      title="Здоровье"
      icon="heart"
      className="vitals-panel"
      actions={
        <span className={`status-chip tone-${status.tone}`}>
          {status.label}
        </span>
      }
    >
      <div className="vitals-head">
        <RecoveriesReadout />
        <div className="vitals-current">
          <input
            className={`vital-big vital-current-input numeric${stamina.current <= 0 ? " is-down" : ""}`}
            inputMode="numeric"
            aria-label="Текущая выносливость (исправить значение)"
            title="Нажмите, чтобы исправить текущее значение"
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
          <span
            className="vital-max-edit"
            title="Максимум выносливости — измените и нажмите Enter"
          >
            <span className="vital-max-slash numeric">/</span>
            <NumberInput
              value={Number(maxDraft) || 0}
              min={0}
              max={999}
              label="Максимум выносливости"
              className="vital-max-input"
              onChange={(value) => setMaxDraft(String(value))}
              onCommit={commitMax}
              onBlur={() => commitMax()}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  event.currentTarget.blur();
                }
                if (event.key === "Escape") {
                  setMaxDraft(String(character.stamina.max));
                  event.currentTarget.blur();
                }
              }}
            />
          </span>
          {stamina.temp > 0 && (
            <button
              type="button"
              className="vital-temp mono vital-temp-clear"
              title="Сбросить временную выносливость"
              aria-label={`Временная выносливость ${stamina.temp}: сбросить`}
              onClick={() => patch({ stamina: { ...stamina, temp: 0 } })}
            >
              +{stamina.temp} врем. ×
            </button>
          )}
        </div>
      </div>

      {character.automation?.enabled && (
        <>
          <StatBreakdown
            label="максимума выносливости"
            breakdown={characterStatBreakdown(character, "stamina")}
          />
          <StatBreakdown
            label="восстановлений"
            breakdown={characterStatBreakdown(character, "recoveries")}
          />
        </>
      )}

      <div
        className="meter"
        role="img"
        aria-label={`Выносливость: ${stamina.current} из ${max}, временная ${stamina.temp}`}
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
            title={`Порог утомления: ${winded}`}
          />
        )}
      </div>

      <HealthControls />
    </Panel>
  );
}
