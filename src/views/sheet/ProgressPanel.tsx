import { useLocale } from "../../i18n/locale";
import { lazy, Suspense } from "react";
import "./ProgressPanel.css";
import { Icon } from "../../components/Icons";
import { Button, Field, NumberInput, Panel, Stepper, TextInput } from "../../components/ui";
import { levelUpProgress, MAX_CHARACTER_LEVEL } from "../../lib/level-up-progress";
import { echelon } from "../../lib/progression";
import { useApp } from "../../state/AppContext";

const LevelUpShortcut = lazy(() => import("./LevelUpShortcut").then((module) => ({ default: module.LevelUpShortcut })));

/** Уровень и эшелон героя, победы, опыт, богатство и известность. */
export function ProgressPanel() {
  const { t, locale } = useLocale();
  const { character, patch } = useApp();
  const levelUpPlan = levelUpProgress(character);
  const currentEchelon = echelon(character.level);
  const ordinal = new Intl.PluralRules("en", { type: "ordinal" }).select(currentEchelon);
  const suffix = ({ one: "st", two: "nd", few: "rd", other: "th", zero: "th", many: "th" } as const)[ordinal];
  const maxLevel = character.level >= MAX_CHARACTER_LEVEL;
  const xpTarget = levelUpPlan.xpRequired;
  const xpProgress = maxLevel || xpTarget <= 0
    ? 1
    : Math.max(0, Math.min(1, character.xp / xpTarget));

  return (
    <Panel className="progress-panel" dense>
      <div className="progress-layout">
        <div className="progress-header" role="group" aria-label={t("Уровень и эшелон", "Level and echelon")}>
          <div className="progress-level-summary">
            <span className="progress-level-value">
              <span className="sr-only">{t(`Уровень ${character.level}`, `Level ${character.level}`)}</span>
              <span aria-hidden="true">{character.level}</span>
              <span className="progress-level-unit" aria-hidden="true">{t("уровень", "level")}</span>
            </span>
            <span className="progress-echelon">{locale === "en" ? `${currentEchelon}${suffix} echelon` : `${currentEchelon}-й эшелон`}</span>
          </div>
          {!maxLevel && levelUpPlan.xpMissing === 0 && (
            <Suspense fallback={
              <span className="progress-level-up-wrap">
                <Button variant="soft" className="progress-level-up-trigger" disabled aria-label={t("Повысить уровень", "Level up")} title={t("Проверка повышения уровня…", "Checking level up…")}>
                  <Icon name="arrow-up" size={20} />
                </Button>
              </span>
            }>
              <LevelUpShortcut />
            </Suspense>
          )}
        </div>

        <div className="progress-counters">
          <Field label={t("Победы", "Victories")}>
            <Stepper
              value={character.victories}
              min={0}
              max={999}
              label={t("Победы", "Victories")}
              onChange={(victories) => patch({ victories })}
            />
          </Field>
          <div className="progress-xp">
            <div className="progress-xp-label">
              <span>{t("Опыт", "Experience")}</span>
              <div className="progress-xp-value">
                <NumberInput showButtons={false} min={0} max={999999} value={character.xp}
                  label={t("Опыт", "Experience")} onChange={(xp) => patch({ xp })} />
                {maxLevel ? <span>{t("максимальный уровень", "maximum level")}</span> : (
                  <>
                    <span>/</span>
                    <NumberInput showButtons={false} min={0} max={999999} value={xpTarget}
                      label={t("Порог опыта для следующего уровня", "Experience required for next level")}
                      onChange={(value) => patch({ xpThreshold: { level: levelUpPlan.toLevel, value } })} />
                  </>
                )}
              </div>
            </div>
            <div className="meter progress-xp-meter" role="progressbar"
              aria-label={t("Опыт до следующего уровня", "Experience towards next level")} aria-valuemin={0} aria-valuemax={100}
              aria-valuenow={Math.round(xpProgress * 100)}
              aria-valuetext={maxLevel ? t("Максимальный уровень", "Maximum level") : t(`${character.xp} из ${xpTarget}; осталось ${levelUpPlan.xpMissing}`, `${character.xp} of ${xpTarget}; ${levelUpPlan.xpMissing} remaining`)}>
              <span className="meter-fill" style={{ width: `${xpProgress * 100}%` }} />
            </div>
          </div>
        </div>

        <div className="progress-standing">
          <Field label={t("Богатство", "Wealth")}>
            <TextInput
              value={character.wealth}
              placeholder={t("напр., 500 ветров", "e.g. 500 wind")}
              onChange={(event) => patch({ wealth: event.target.value })}
            />
          </Field>
          <Field label={t("Известность", "Renown")}>
            <TextInput
              value={character.renown}
              placeholder={t("напр., 3", "e.g. 3")}
              onChange={(event) => patch({ renown: event.target.value })}
            />
          </Field>
        </div>
      </div>
    </Panel>
  );
}
