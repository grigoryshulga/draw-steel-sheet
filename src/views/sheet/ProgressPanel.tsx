import { useCallback, useState } from "react";
import "./ProgressPanel.css";
import { Icon } from "../../components/Icons";
import { Button, Field, Modal, NumberInput, Panel, Stepper, TextInput } from "../../components/ui";
import { getLevelUpPlan } from "../../lib/level-up";
import { echelon } from "../../lib/progression";
import { useApp } from "../../state/AppContext";
import { LevelUpDialog, LevelUpHistory } from "./LevelUpDialog";

/** Уровень и эшелон героя, победы, опыт, богатство и известность. */
export function ProgressPanel() {
  const { character, patch } = useApp();
  const [levelUpOpen, setLevelUpOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const closeLevelUp = useCallback(() => setLevelUpOpen(false), []);
  const levelUpPlan = getLevelUpPlan(character);
  const currentEchelon = echelon(character.level);

  return (
    <Panel
      title="Развитие"
      icon="spark"
      className="progress-panel"
      actions={character.advancements?.length ? (
        <Button size="sm" variant="ghost" onClick={() => setHistoryOpen(true)}>
          История · {character.advancements.length}
        </Button>
      ) : undefined}
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
      <Modal open={historyOpen} onClose={() => setHistoryOpen(false)} title="История повышений уровня" className="level-up-dialog">
        <LevelUpHistory character={character} />
      </Modal>
      <LevelUpDialog
        open={levelUpOpen}
        onClose={closeLevelUp}
      />
    </Panel>
  );
}
