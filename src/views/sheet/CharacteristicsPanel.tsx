import { Field, Panel, Stepper, TextInput } from "../../components/ui";
import { CharacteristicGlyph } from "../../components/CharacteristicGlyph";
import { HelpTooltip } from "../../components/HelpTooltip";
import { CHARACTERISTICS } from "../../lib/rules";
import { characterStatBreakdown } from "../../lib/character-calculations";
import { effectiveCharacteristics } from "../../lib/feature-modifiers";
import { useApp } from "../../state/AppContext";
import { StatBreakdown } from "./StatBreakdown";
import "./CharacteristicsPanel.css";

/** Пять характеристик с тестами и порогами тиров. */
export function CharacteristicsPanel() {
  const { character, derived, patch } = useApp();
  // Эффективные значения считает движок (сохранённое + бонусы особенностей,
  // с теми же ограничениями); правится по-прежнему сохранённое значение.
  const effective = effectiveCharacteristics(character);

  return (
    <Panel
      title="Характеристики"
      icon="spark"
      className="char-panel"
      dense
      actions={
        <HelpTooltip label="Пороги бросков 2d10">
          <div className="stat-breakdown-equation">
            <strong>Пороги бросков 2d10</strong>
            {CHARACTERISTICS.map((meta) => {
              const threshold = derived.tierThresholds[meta.key];
              return (
                <p key={meta.key}>
                  <strong>{meta.short}</strong>{" · "}
                  <span>Т1 ≤ {threshold.t2 - 1}</span>{" · "}
                  <span>
                    Т2 {threshold.t2}–{threshold.t3 - 1}
                  </span>{" · "}
                  <span>Т3 ≥ {threshold.t3}</span>
                </p>
              );
            })}
          </div>
        </HelpTooltip>
      }
    >
      <div className="char-grid">
        {CHARACTERISTICS.map((meta) => {
          const value = character.characteristics[meta.key];
          const shown = effective[meta.key];
          const bonus = shown - value;
          return (
            <div className="stat-card" key={meta.key}>
              <div className="stat-card-head">
                <span className="stat-name-with-glyph">
                  <span aria-hidden="true"><CharacteristicGlyph characteristic={meta.key} /></span>
                  <span className="stat-name">{meta.label}</span>
                </span>
                {bonus !== 0 && (
                  <span
                    className="stat-effective"
                    title={`${bonus > 0 ? "+" : ""}${bonus} от особенностей`}
                    aria-label={`${meta.label}: эффективное значение ${shown}, ${bonus > 0 ? "+" : ""}${bonus} от особенностей`}
                  >
                    {shown}
                    <span className="stat-effective-delta">
                      {bonus > 0 ? `+${bonus}` : bonus}
                    </span>
                  </span>
                )}
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
          <div className="field">
            <span className="field-label stat-label-with-help">
              Скорость
              {character.automation?.enabled && (
                <StatBreakdown label="скорости" breakdown={characterStatBreakdown(character, "speed")} />
              )}
            </span>
            <TextInput
              className="numeric"
              value={character.speed}
              placeholder="5"
              aria-label="Скорость"
              title="Скорость в клетках"
              onChange={(event) => patch({ speed: event.target.value })}
            />
          </div>
        </div>
        <div>
          <div className="field">
            <span className="field-label stat-label-with-help">
              Отход
              {character.automation?.enabled && (
                <StatBreakdown label="отхода" breakdown={characterStatBreakdown(character, "disengage")} />
              )}
            </span>
            <TextInput
              className="numeric"
              value={character.disengage}
              placeholder="1"
              aria-label="Отход"
              title="Сколько клеток можно сместиться при отходе"
              onChange={(event) => patch({ disengage: event.target.value })}
            />
          </div>
        </div>
        <div>
          <div className="field">
            <span className="field-label stat-label-with-help">
              Устойчивость
              {character.automation?.enabled && (
                <StatBreakdown label="устойчивости" breakdown={characterStatBreakdown(character, "stability")} />
              )}
            </span>
            <TextInput
              className="numeric"
              value={character.stability}
              placeholder="0"
              aria-label="Устойчивость"
              title="Сопротивление принудительному движению"
              onChange={(event) => patch({ stability: event.target.value })}
            />
          </div>
        </div>
        <div className="field potency-group">
          <span className="field-label stat-label-with-help">
            Потенциал
            <HelpTooltip label="Расчёт и применение потенциала">
              <strong>Потенциал</strong>
              <p>Наивысшая характеристика: {derived.highestCharacteristic}.</p>
              <p>Слабый: {derived.potency.weak} · Средний: {derived.potency.average} · Сильный: {derived.potency.strong}.</p>
              <p>Эффект применяется, если характеристика цели строго ниже порога.</p>
            </HelpTooltip>
          </span>
          <div className="potency-group-values">
            {([
              ["Слабый", derived.potency.weak],
              ["Средний", derived.potency.average],
              ["Сильный", derived.potency.strong],
            ] as const).map(([label, value]) => (
              <output className="input numeric potency-compact" key={label} aria-label={`${label} потенциал: ${value}`}>
                <span className="potency-compact-label" aria-hidden="true">{label}</span>
                <span aria-hidden="true">{value}</span>
              </output>
            ))}
          </div>
        </div>
      </div>
    </Panel>
  );
}
