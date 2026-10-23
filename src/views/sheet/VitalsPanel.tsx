import { useEffect, useState } from "react";
import { Button, NumberInput, Panel, Stepper } from "../../components/ui";
import { clamp, vitalStatus } from "../../lib/rules";
import type { HealthOperation } from "../../lib/game-actions";
import { useApp } from "../../state/AppContext";
import { HealthDialog } from "./HealthDialog";

/** Здоровье: выносливость, урон, восстановления и отдых. */
export function VitalsPanel() {
  const { character, derived, patch, performGameAction } = useApp();
  const [maxDraft, setMaxDraft] = useState(String(character.stamina.max));
  const [operation, setOperation] = useState<HealthOperation | null>(null);

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
  const tempPct =
    max > 0 ? clamp((stamina.temp / max) * 100, 0, 100 - fillPct) : 0;

  return (
    <Panel title="Здоровье" icon="heart" className="vitals-panel">
      <div className="vitals-head">
        <div className="vitals-status">
          <span className={`status-chip tone-${status.tone}`}>
            {status.label}
          </span>
        </div>
        <div className="vitals-current">
          <span
            className={`vital-big numeric${stamina.current <= 0 ? " is-down" : ""}`}
          >
            {stamina.current}
          </span>
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
            <span className="vital-temp mono">+{stamina.temp} врем.</span>
          )}
        </div>
      </div>

      <div
        className="meter"
        role="img"
        aria-label={`Выносливость: ${stamina.current} из ${max}, временная ${stamina.temp}`}
      >
        <span
          className={`meter-fill tone-${status.tone}`}
          style={{ width: `${fillPct}%` }}
        />
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

      <div className="vitals-controls vitals-action-buttons">
        <Button
          size="sm"
          variant="danger"
          icon="sword"
          onClick={() => setOperation("damage")}
        >
          Получить урон
        </Button>
        <Button
          size="sm"
          variant="soft"
          icon="heart"
          onClick={() => setOperation("heal")}
        >
          Исцелиться
        </Button>
        <Button
          size="sm"
          variant="soft"
          onClick={() => setOperation("temporary")}
        >
          Временная выносливость
        </Button>
        <Button
          size="sm"
          variant="soft"
          icon="heart"
          onClick={() => setOperation("recovery")}
        >
          Передышка (+{derived.recoveryValue})
        </Button>
        <Button
          size="sm"
          variant="soft"
          icon="sun"
          onClick={() => setOperation("rest")}
        >
          Отдых
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setOperation("adjust")}
        >
          Исправить значение
        </Button>
      </div>

      <details className="vitals-temp-manual">
        <summary>Настроить текущий временный запас</summary>
        <NumberInput
          value={stamina.temp}
          min={0}
          max={999}
          label="Текущая временная выносливость"
          className="tiny-num"
          onChange={(temp) => patch({ stamina: { ...stamina, temp } })}
        />
      </details>

      <div className="vital-block health-recoveries">
        <div className="between">
          <span className="eyebrow">Восстановления</span>
        </div>
        <div className="vital-block-row">
          <Stepper
            value={character.recoveries.current}
            min={0}
            max={character.recoveries.max}
            label="Текущие восстановления"
            className="sheet-large-counter"
            onChange={(current) =>
              performGameAction({
                kind: "resource",
                resource: "recoveries",
                value: current,
              })
            }
          />
          <span className="small muted max-edit">
            макс
            <NumberInput
              value={character.recoveries.max}
              min={0}
              max={99}
              label="Максимум восстановлений"
              className="tiny-num"
              onChange={(value) =>
                patch({ recoveries: { ...character.recoveries, max: value } })
              }
            />
          </span>
        </div>
      </div>
      {operation && (
        <HealthDialog
          initialOperation={operation}
          onClose={() => setOperation(null)}
        />
      )}
    </Panel>
  );
}
