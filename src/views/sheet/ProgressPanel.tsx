import { useCallback, useState } from "react";
import { Button, Field, NumberInput, Panel, Stepper, TextInput } from "../../components/ui";
import { getLevelUpPlan } from "../../lib/level-up";
import { useApp } from "../../state/AppContext";
import { LevelUpDialog, LevelUpHistory } from "./LevelUpDialog";

/** Прогрессия героя: победы, опыт, эпик, богатство и известность. */
export function ProgressPanel() {
  const { character, patch } = useApp();
  const [levelUpOpen, setLevelUpOpen] = useState(false);
  const closeLevelUp = useCallback(() => setLevelUpOpen(false), []);
  const levelUpPlan = getLevelUpPlan(character);

  return (
    <Panel
      title="Развитие"
      icon="spark"
      className="progress-panel"
      dense
    >
      <div className="progress-grid">
        <Field
          label={<span title="Ручная коррекция уровня не выдаёт награды и особенности.">Уровень · ручная коррекция</span>}
          className="progress-level-field"
        >
          <Stepper
            value={character.level}
            min={1}
            max={10}
            label="Уровень"
            onChange={(level) => patch({ level })}
          />
          <Button
            size="sm"
            variant="soft"
            className="progress-level-up-button"
            disabled={!levelUpPlan.available}
            title={levelUpPlan.available ? "Открыть повышение на следующий уровень" : levelUpPlan.reason}
            onClick={() => setLevelUpOpen(true)}
          >
            Повысить уровень
          </Button>
          {!levelUpPlan.available && levelUpPlan.reason && (
            <span className="progress-level-up-reason" role="status">
              {levelUpPlan.reason}
            </span>
          )}
        </Field>
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
        <Field label="Эпик">
          <NumberInput
            min={0}
            max={9999}
            value={character.epic}
            label="Эпические очки"
            onChange={(epic) => patch({ epic })}
          />
        </Field>
        <Field label="Богатство">
          <TextInput
            value={character.wealth}
            placeholder="напр., 500 ветров"
            onChange={(event) => patch({ wealth: event.target.value })}
          />
        </Field>
        <Field label="Известность" className="progress-wide">
          <TextInput
            value={character.renown}
            placeholder="напр., 3"
            onChange={(event) => patch({ renown: event.target.value })}
          />
        </Field>
      </div>
      <LevelUpHistory character={character} />
      <LevelUpDialog
        open={levelUpOpen}
        onClose={closeLevelUp}
      />
    </Panel>
  );
}
