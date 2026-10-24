import { useCallback, useState } from "react";
import "./ProgressPanel.css";
import { Icon } from "../../components/Icons";
import { Button, Field, NumberInput, Panel, Stepper, TextInput } from "../../components/ui";
import { getLevelUpPlan } from "../../lib/level-up";
import { echelon } from "../../lib/progression";
import { useApp } from "../../state/AppContext";
import { LevelUpDialog, LevelUpHistory } from "./LevelUpDialog";

/** Уровень и эшелон героя, победы, опыт, богатство и известность. */
export function ProgressPanel() {
  const { character, patch } = useApp();
  const [levelUpOpen, setLevelUpOpen] = useState(false);
  const closeLevelUp = useCallback(() => setLevelUpOpen(false), []);
  const levelUpPlan = getLevelUpPlan(character);
  const currentEchelon = echelon(character.level);

  return (
    <Panel
      title="Развитие"
      icon="spark"
      className="progress-panel"
      dense
    >
      <div className="progress-layout">
        <div className="progress-header" role="group" aria-label="Уровень и эшелон">
          <div className="progress-level-summary">
            <span className="progress-level-value">
              <span className="sr-only">Уровень {character.level}</span>
              <span aria-hidden="true">{character.level}</span>
              <span className="progress-level-unit" aria-hidden="true">ур</span>
            </span>
            <span className="progress-echelon">{currentEchelon}-й эшелон</span>
          </div>
          <span
            className="progress-level-up-wrap"
            title={!levelUpPlan.available ? levelUpPlan.reason : undefined}
          >
            <Button
              variant="soft"
              className="progress-level-up-trigger"
              disabled={!levelUpPlan.available}
              title="Повысить уровень"
              aria-label="Повысить уровень"
              onClick={() => setLevelUpOpen(true)}
            >
              <Icon name="arrow-up" size={20} />
            </Button>
          </span>
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
          <Field label="Опыт">
            <NumberInput
              min={0}
              max={999999}
              value={character.xp}
              label="Опыт"
              onChange={(xp) => patch({ xp })}
            />
          </Field>
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
      <LevelUpHistory character={character} />
      <LevelUpDialog
        open={levelUpOpen}
        onClose={closeLevelUp}
      />
    </Panel>
  );
}
