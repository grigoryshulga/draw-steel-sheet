import { useLocale } from "../../i18n/locale";
import { Field, Panel, Stepper, TextInput } from "../../components/ui";
import { CharacteristicGlyph } from "../../components/CharacteristicGlyph";
import { HelpTooltip } from "../../components/HelpTooltip";
import { CHARACTERISTICS } from "../../lib/rules";
import { characterStatBreakdown } from "../../lib/character-calculations";
import { effectiveCharacteristics } from "../../lib/feature-modifiers";
import { stormwightFormState } from "../../lib/stormwight-forms";
import { useApp } from "../../state/AppContext";
import { StatBreakdown } from "./StatBreakdown";
import "./CharacteristicsPanel.css";

/** Пять характеристик с тестами и порогами тиров. */
export function CharacteristicsPanel() {
  const { t, locale } = useLocale();
  const { character, derived, patch, readOnly } = useApp();
  // Эффективные значения считает движок (сохранённое + бонусы особенностей,
  // с теми же ограничениями); правится по-прежнему сохранённое значение.
  const effective = effectiveCharacteristics(character);
  const form = stormwightFormState(character);
  const sizeFromForm = !!character.automation?.enabled && !!form && form.form !== "true";

  return (
    <Panel
      title={t("Характеристики", "Characteristics")}
      icon="spark"
      className="char-panel"
      dense
      actions={
        <HelpTooltip label={t("Пороги бросков 2d10", "2d10 roll thresholds")}>
          <div className="stat-breakdown-equation">
            <strong>{t("Пороги бросков 2d10", "2d10 roll thresholds")}</strong>
            {CHARACTERISTICS.map((meta) => {
              const threshold = derived.tierThresholds[meta.key];
              return (
                <p key={meta.key}>
                  <strong>{locale === "en" ? meta.key[0].toUpperCase() : meta.short}</strong>{" · "}
                  <span>{t("Т1", "T1")} ≤ {threshold.t2 - 1}</span>{" · "}
                  <span>
                    {t("Т2", "T2")} {threshold.t2}–{threshold.t3 - 1}
                  </span>{" · "}
                  <span>{t("Т3", "T3")} ≥ {threshold.t3}</span>
                </p>
              );
            })}
          </div>
        </HelpTooltip>
      }
    >
      <div className="char-grid">
        {CHARACTERISTICS.map((meta) => {
          const name = t(meta.label, meta.key[0].toUpperCase() + meta.key.slice(1));
          const value = character.characteristics[meta.key];
          const shown = effective[meta.key];
          const bonus = shown - value;
          return (
            <div className="stat-card" key={meta.key}>
              <div className="stat-card-head">
                <span className="stat-name-with-glyph">
                  <span aria-hidden="true"><CharacteristicGlyph characteristic={meta.key} language={locale} /></span>
                  <span className="stat-name">{name}</span>
                </span>
                {bonus !== 0 && (
                  <span
                    className="stat-effective"
                    title={t(`${bonus > 0 ? "+" : ""}${bonus} от особенностей`, `${bonus > 0 ? "+" : ""}${bonus} from features`)}
                    aria-label={t(`${name}: эффективное значение ${shown}, ${bonus > 0 ? "+" : ""}${bonus} от особенностей`, `${name}: effective score ${shown}, ${bonus > 0 ? "+" : ""}${bonus} from features`)}
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
                label={t(`Характеристика: ${meta.label}`, `Characteristic: ${name}`)}
                onChange={readOnly ? undefined : (next) =>
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
        <Field label={t("Размер", "Size")}>
          <TextInput
            className="numeric"
            value={character.size}
            placeholder="1"
            aria-label={t("Размер", "Size")}
            readOnly={readOnly || sizeFromForm}
            title={sizeFromForm ? t("Размер задан текущей формой. Размер гибрида выбирается в панели форм.", "Your current form sets your size. Select your hybrid size in the forms panel.") : t("Размер существа: 1T, 1S, 1M, 1L и так далее", "Creature size, such as 1T, 1S, 1M, or 1L")}
            onChange={(event) => patch({ size: event.target.value })}
          />
        </Field>
        <div>
          <div className="field">
            <span className="field-label stat-label-with-help">
              {t("Скорость", "Speed")}
              {character.automation?.enabled && (
                <StatBreakdown label={t("скорости", "speed")} breakdown={characterStatBreakdown(character, "speed")} />
              )}
            </span>
            <TextInput
              className="numeric"
              value={character.speed}
              placeholder="5"
              aria-label={t("Скорость", "Speed")}
              readOnly={readOnly}
              title={t("Скорость в клетках", "Speed in squares")}
              onChange={(event) => patch({ speed: event.target.value })}
            />
          </div>
        </div>
        <div>
          <div className="field">
            <span className="field-label stat-label-with-help">
              {t("Отход", "Disengage")}
              {character.automation?.enabled && (
                <StatBreakdown label={t("отхода", "disengage")} breakdown={characterStatBreakdown(character, "disengage")} />
              )}
            </span>
            <TextInput
              className="numeric"
              value={character.disengage}
              placeholder="1"
              aria-label={t("Отход", "Disengage")}
              readOnly={readOnly}
              title={t("Сколько клеток можно сместиться при отходе", "Squares you can shift when disengaging")}
              onChange={(event) => patch({ disengage: event.target.value })}
            />
          </div>
        </div>
        <div>
          <div className="field">
            <span className="field-label stat-label-with-help">
              {t("Устойчивость", "Stability")}
              {character.automation?.enabled && (
                <StatBreakdown label={t("устойчивости", "stability")} breakdown={characterStatBreakdown(character, "stability")} />
              )}
            </span>
            <TextInput
              className="numeric"
              value={character.stability}
              placeholder="0"
              aria-label={t("Устойчивость", "Stability")}
              readOnly={readOnly}
              title={t("Сопротивление принудительному движению", "Resistance to forced movement")}
              onChange={(event) => patch({ stability: event.target.value })}
            />
          </div>
        </div>
        <div className="field potency-group">
          <span className="field-label stat-label-with-help">
            {t("Потенциал", "Potency")}
            <HelpTooltip label={t("Расчёт и применение потенциала", "Potency calculation and use")}>
              <strong>{t("Потенциал", "Potency")}</strong>
              <p>{t("Наивысшая характеристика", "Highest characteristic")}: {derived.highestCharacteristic}.</p>
              <p>{t("Слабый", "Weak")}: {derived.potency.weak} · {t("Средний", "Average")}: {derived.potency.average} · {t("Сильный", "Strong")}: {derived.potency.strong}.</p>
              <p>{t("Эффект применяется, если характеристика цели строго ниже порога.", "The effect applies if the target’s characteristic is strictly below the threshold.")}</p>
            </HelpTooltip>
          </span>
          <output className="input numeric potency-group-values" aria-label={t(`Потенциал: слабый ${derived.potency.weak}, средний ${derived.potency.average}, сильный ${derived.potency.strong}`, `Potency: weak ${derived.potency.weak}, average ${derived.potency.average}, strong ${derived.potency.strong}`)}>
            {([
              [t("Слабый", "Weak"), derived.potency.weak],
              [t("Средний", "Average"), derived.potency.average],
              [t("Сильный", "Strong"), derived.potency.strong],
            ] as const).map(([label, value]) => (
              <span className="potency-compact" key={label}>
                <span className="potency-compact-label" aria-hidden="true">{label}</span>
                <span aria-hidden="true">{value}</span>
              </span>
            ))}
          </output>
        </div>
      </div>
    </Panel>
  );
}
