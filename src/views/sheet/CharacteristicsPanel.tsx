import { Field, Panel, Stepper, TextInput } from "../../components/ui";
import { CHARACTERISTICS } from "../../lib/rules";
import { characterStatBreakdown } from "../../lib/character-calculations";
import { useApp } from "../../state/AppContext";
import { StatBreakdown } from "./StatBreakdown";

/** Пять характеристик с тестами и порогами тиров. */
export function CharacteristicsPanel() {
  const { character, derived, patch } = useApp();

  return (
    <Panel title="Характеристики" icon="spark" className="char-panel" dense>
      <div className="char-grid">
        {CHARACTERISTICS.map((meta) => {
          const value = character.characteristics[meta.key];
          return (
            <div className="stat-card" key={meta.key}>
              <div className="stat-card-head">
                <span className="stat-name">{meta.label}</span>
              </div>
              <Stepper
                value={value}
                min={-5}
                max={5}
                label={`Характеристика: ${meta.label}`}
                onChange={(next) =>
                  patch({
                    characteristics: {
                      ...character.characteristics,
                      [meta.key]: next,
                    },
                  })
                }
              />
            </div>
          );
        })}
      </div>
      <details className="characteristic-thresholds">
        <summary>Пороги бросков 2d10</summary>
        <div>
          {CHARACTERISTICS.map((meta) => {
            const threshold = derived.tierThresholds[meta.key];
            return (
              <p key={meta.key}>
                <strong>{meta.short}</strong>
                <span>Т1 ≤ {threshold.t2 - 1}</span>
                <span>
                  Т2 {threshold.t2}–{threshold.t3 - 1}
                </span>
                <span>Т3 ≥ {threshold.t3}</span>
              </p>
            );
          })}
        </div>
      </details>

      <div className="movement-grid">
        <Field label="Размер">
          <TextInput
            className="numeric"
            value={character.size}
            placeholder="1"
            aria-label="Размер"
            title="Размер существа: 1T, 1S, 1M, 1L и так далее"
            onChange={(event) => patch({ size: event.target.value })}
          />
        </Field>
        <div>
          <Field label="Скорость">
            <TextInput
              className="numeric"
              value={character.speed}
              placeholder="5"
              aria-label="Скорость"
              title="Скорость в клетках"
              onChange={(event) => patch({ speed: event.target.value })}
            />
          </Field>
          {character.automation?.enabled && (
            <StatBreakdown label="скорости" breakdown={characterStatBreakdown(character, "speed")} />
          )}
        </div>
        <div>
          <Field label="Отход">
            <TextInput
              className="numeric"
              value={character.disengage}
              placeholder="1"
              aria-label="Отход"
              title="Сколько клеток можно сместиться при отходе"
              onChange={(event) => patch({ disengage: event.target.value })}
            />
          </Field>
          {character.automation?.enabled && (
            <StatBreakdown label="отхода" breakdown={characterStatBreakdown(character, "disengage")} />
          )}
        </div>
        <div>
          <Field label="Устойчивость">
            <TextInput
              className="numeric"
              value={character.stability}
              placeholder="0"
              aria-label="Устойчивость"
              title="Сопротивление принудительному движению"
              onChange={(event) => patch({ stability: event.target.value })}
            />
          </Field>
          {character.automation?.enabled && (
            <StatBreakdown label="устойчивости" breakdown={characterStatBreakdown(character, "stability")} />
          )}
        </div>
      </div>
    </Panel>
  );
}
