import { useEffect, useState } from "react";
import { Button, NumberInput, Panel, Stepper } from "../../components/ui";
import { applyDamage, clamp, vitalStatus } from "../../lib/rules";
import { useApp } from "../../state/AppContext";

/** Здоровье: выносливость, урон, восстановления и отдых. */
export function VitalsPanel() {
  const { character, derived, patch, notify } = useApp();
  const [damage, setDamage] = useState(0);
  const [maxDraft, setMaxDraft] = useState(String(character.stamina.max));

  useEffect(() => {
    setMaxDraft(String(character.stamina.max));
  }, [character.stamina.max]);

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
  const floor = max > 0 ? -Math.max(1, winded) : stamina.current;
  const fillPct = max > 0 ? clamp((stamina.current / max) * 100, 0, 100) : 0;
  const tempPct =
    max > 0 ? clamp((stamina.temp / max) * 100, 0, 100 - fillPct) : 0;

  const shiftCurrent = (delta: number) => {
    patch({
      stamina: {
        ...stamina,
        current: clamp(stamina.current + delta, floor, max),
      },
    });
  };

  const takeDamage = () => {
    const amount = Math.max(0, Math.floor(damage));
    setDamage(0);
    if (amount === 0) return;
    const applied = applyDamage(stamina.current, stamina.temp, amount);
    patch({
      stamina: { ...stamina, current: applied.stamina, temp: applied.temp },
    });
    notify(
      applied.absorbed > 0
        ? `Урон ${amount}: ${applied.absorbed} поглотила временная выносливость`
        : `Получен урон: ${amount}`,
      applied.stamina <= 0 ? "error" : "info",
    );
  };

  const spendRecovery = () => {
    if (character.recoveries.current <= 0) {
      notify("Восстановления закончились", "error");
      return;
    }
    if (stamina.current >= max) {
      notify(
        "Выносливость уже максимальна — восстановление не потрачено",
        "info",
      );
      return;
    }
    const heal = derived.recoveryValue;
    patch({
      recoveries: {
        ...character.recoveries,
        current: character.recoveries.current - 1,
      },
      stamina: { ...stamina, current: Math.min(max, stamina.current + heal) },
    });
    notify(`Передышка: +${heal} выносливости`, "success");
  };

  const rest = () => {
    patch({
      stamina: { ...stamina, current: max, temp: 0 },
      recoveries: {
        ...character.recoveries,
        current: character.recoveries.max,
      },
      heroicResource: { ...character.heroicResource, current: 0 },
      surges: 0,
    });
    notify("Отдых: выносливость и восстановления восстановлены", "success");
  };

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
              onCommit={(value) => commitMax(value)}
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

      <div className="vitals-controls">
        <div className="vitals-adjust">
          <Button
            size="sm"
            variant="soft"
            onClick={() => shiftCurrent(-5)}
            aria-label="Выносливость: минус 5"
          >
            −5
          </Button>
          <Button
            size="sm"
            variant="soft"
            onClick={() => shiftCurrent(-1)}
            aria-label="Выносливость: минус 1"
          >
            −1
          </Button>
          <Button
            size="sm"
            variant="soft"
            onClick={() => shiftCurrent(1)}
            aria-label="Выносливость: плюс 1"
          >
            +1
          </Button>
          <Button
            size="sm"
            variant="soft"
            onClick={() => shiftCurrent(5)}
            aria-label="Выносливость: плюс 5"
          >
            +5
          </Button>
          <span className="vital-temp-edit small muted">
            врем.
            <NumberInput
              value={stamina.temp}
              min={0}
              max={999}
              label="Временная выносливость"
              className="tiny-num"
              onChange={(temp) => patch({ stamina: { ...stamina, temp } })}
            />
          </span>
        </div>

        <div className="damage-row">
          <span className="damage-prefix eyebrow">Урон</span>
          <NumberInput
            min={0}
            max={999}
            placeholder="0"
            label="Количество урона"
            className="damage-input"
            value={damage}
            onChange={setDamage}
          />
          <Button variant="danger" icon="sword" onClick={takeDamage}>
            Получить
          </Button>
        </div>

        <div className="vitals-rest">
          <Button
            size="sm"
            variant="soft"
            icon="heart"
            onClick={spendRecovery}
            disabled={
              character.recoveries.current <= 0 || stamina.current >= max
            }
            title={
              stamina.current >= max
                ? "Выносливость уже максимальна"
                : "Потратить восстановление и восстановить выносливость"
            }
          >
            Передышка (+{derived.recoveryValue})
          </Button>
          <Button size="sm" variant="soft" icon="sun" onClick={rest}>
            Отдых
          </Button>
        </div>
      </div>

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
              patch({ recoveries: { ...character.recoveries, current } })
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
    </Panel>
  );
}
