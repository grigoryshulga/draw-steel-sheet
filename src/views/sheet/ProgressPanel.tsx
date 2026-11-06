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
  const { character, patch } = useApp();
  const levelUpPlan = levelUpProgress(character);
  const currentEchelon = echelon(character.level);
  const maxLevel = character.level >= MAX_CHARACTER_LEVEL;
  const xpTarget = levelUpPlan.xpRequired;
  const xpProgress = maxLevel || xpTarget <= 0
    ? 1
    : Math.max(0, Math.min(1, character.xp / xpTarget));

  return (
    <Panel className="progress-panel" dense>
      <div className="progress-layout">
        <div className="progress-header" role="group" aria-label="Уровень и эшелон">
          <div className="progress-level-summary">
            <span className="progress-level-value">
              <span className="sr-only">Уровень {character.level}</span>
              <span aria-hidden="true">{character.level}</span>
              <span className="progress-level-unit" aria-hidden="true">уровень</span>
            </span>
            <span className="progress-echelon">{currentEchelon}-й эшелон</span>
          </div>
          {!maxLevel && levelUpPlan.xpMissing === 0 && (
            <Suspense fallback={
              <span className="progress-level-up-wrap">
                <Button variant="soft" className="progress-level-up-trigger" disabled aria-label="Повысить уровень" title="Проверка повышения уровня…">
                  <Icon name="arrow-up" size={20} />
                </Button>
              </span>
            }>
              <LevelUpShortcut />
            </Suspense>
          )}
        </div>

        <div className="progress-counters">
          <Field label="Победы">
            <Stepper
              value={character.victories}
              min={0}
              max={999}
              label="Победы"
              onChange={(victories) => patch({ victories })}
            />
          </Field>
          <div className="progress-xp">
            <div className="progress-xp-label">
              <span>Опыт</span>
              <div className="progress-xp-value">
                <NumberInput showButtons={false} min={0} max={999999} value={character.xp}
                  label="Опыт" onChange={(xp) => patch({ xp })} />
                {maxLevel ? <span>максимальный уровень</span> : (
                  <>
                    <span>/</span>
                    <NumberInput showButtons={false} min={0} max={999999} value={xpTarget}
                      label="Порог опыта для следующего уровня"
                      onChange={(value) => patch({ xpThreshold: { level: levelUpPlan.toLevel, value } })} />
                  </>
                )}
              </div>
            </div>
            <div className="meter progress-xp-meter" role="progressbar"
              aria-label="Опыт до следующего уровня" aria-valuemin={0} aria-valuemax={100}
              aria-valuenow={Math.round(xpProgress * 100)}
              aria-valuetext={maxLevel ? "Максимальный уровень" : `${character.xp} из ${xpTarget}; осталось ${levelUpPlan.xpMissing}`}>
              <span className="meter-fill" style={{ width: `${xpProgress * 100}%` }} />
            </div>
          </div>
        </div>

        <div className="progress-standing">
          <Field label="Богатство">
            <TextInput
              value={character.wealth}
              placeholder="напр., 500 ветров"
              onChange={(event) => patch({ wealth: event.target.value })}
            />
          </Field>
          <Field label="Известность">
            <TextInput
              value={character.renown}
              placeholder="напр., 3"
              onChange={(event) => patch({ renown: event.target.value })}
            />
          </Field>
        </div>
      </div>
    </Panel>
  );
}
