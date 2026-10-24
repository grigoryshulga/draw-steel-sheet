import { useState } from "react";
import { Button, Field, Panel, Select, Toggle } from "../../components/ui";
import {
  CONDITIONS,
  CONDITION_END_OPTIONS,
  SAVE_ENDS_TARGET,
} from "../../data/conditions";
import { useApp } from "../../state/AppContext";
import { featureStatBonus, featureStatContributions } from "../../lib/feature-modifiers";
import type { ConditionEnd, ConditionState } from "../../types";
import "./ConditionsPanel.css";

const INACTIVE: ConditionState = { active: false, ends: "save" };

/** Состояния героя: активные сверху с выбором окончания, остальные — для наложения. */
export function ConditionsPanel() {
  const { character, patch, notify } = useApp();
  const [newCondition, setNewCondition] = useState("");
  const [lastSaveRoll, setLastSaveRoll] = useState<Record<string, string>>({});
  const saveBonus = featureStatBonus(character, "save");
  const saveContributions = featureStatContributions(character, "save");
  const saveSources = saveContributions.map((contribution) => contribution.sourceName).join(", ");

  const entries = CONDITIONS.map((condition) => ({
    ...condition,
    state: character.conditions[condition.key] ?? INACTIVE,
  }));
  const active = entries.filter((entry) => entry.state.active);
  const inactive = entries.filter((entry) => !entry.state.active);
  const selectedKey = inactive.some((entry) => entry.key === newCondition)
    ? newCondition
    : (inactive[0]?.key ?? "");
  const selectedEntry = inactive.find((entry) => entry.key === selectedKey);

  const setCondition = (key: string, state: ConditionState) => {
    patch({ conditions: { ...character.conditions, [key]: state } });
  };

  const activate = (key: string, state: ConditionState) => {
    setCondition(key, { active: true, ends: state.ends });
  };

  const deactivate = (key: string, state: ConditionState) => {
    setCondition(key, { ...state, active: false });
  };

  const setEnd = (key: string, state: ConditionState, ends: ConditionEnd) => {
    setCondition(key, { ...state, ends });
  };

  const rollSave = (key: string, label: string, state: ConditionState) => {
    const d10 = Math.floor(Math.random() * 10) + 1;
    const total = d10 + saveBonus;
    const passed = total >= SAVE_ENDS_TARGET;
    const resultText = `d10 ${d10} + бонус ${saveBonus} = ${total}; нужно ${SAVE_ENDS_TARGET}+`;
    setLastSaveRoll((current) => ({ ...current, [key]: resultText }));
    if (passed) {
      setCondition(key, { ...state, active: false });
      notify(
        `Спасбросок против «${label}»: ${resultText} — состояние снято`,
        "success",
      );
    } else {
      notify(
        `Спасбросок против «${label}»: ${resultText} — состояние остаётся`,
        "info",
      );
    }
  };

  return (
    <Panel
      title="Состояния"
      icon="warning"
      className="conditions-panel"
      dense
    >
      <div className="conditions-active">
        <p className="condition-summary">
          Спасбросок: d10 {saveBonus >= 0 ? "+" : "−"}{Math.abs(saveBonus)}
          {saveSources ? ` · ${saveSources}` : ""}
        </p>
        <div className="conditions-block-head">
          <span className="eyebrow">Активные</span>
        </div>

        {active.length === 0 ? null : (
          <div className="condition-active-list">
            {active.map((entry) => (
              <article className="condition-card" key={entry.key}>
                <header className="condition-card-head">
                  <Toggle
                    checked
                    label={`Состояние: ${entry.label}`}
                    onChange={() => deactivate(entry.key, entry.state)}
                  />
                  <h3>{entry.label}</h3>
                </header>

                <div className="condition-controls">
                  <Field label="Оканчивается">
                    <Select
                      value={entry.state.ends}
                      aria-label={`Когда оканчивается: ${entry.label}`}
                      onChange={(event) =>
                        setEnd(entry.key, entry.state, event.target.value as ConditionEnd)
                      }
                    >
                      {CONDITION_END_OPTIONS.map((option) => (
                        <option key={option.key} value={option.key}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  {entry.state.ends === "save" && (
                    <Button
                      size="sm"
                      variant="soft"
                      icon="dice"
                      onClick={() => rollSave(entry.key, entry.label, entry.state)}
                      title={lastSaveRoll[entry.key]
                        ? `Последний бросок: ${lastSaveRoll[entry.key]}`
                        : `Спасбросок: d10 + бонус ${saveBonus} ≥ ${SAVE_ENDS_TARGET}`}
                    >
                      Спасбросок d10
                    </Button>
                  )}
                </div>

                <p className="condition-summary">{entry.summary}</p>
              </article>
            ))}
          </div>
        )}
      </div>

      <div className="conditions-inactive">
        <div className="conditions-block-head">
          <span className="eyebrow">Наложить</span>
        </div>
        {inactive.length === 0 ? (
          <p className="conditions-empty small muted">Все состояния уже активны.</p>
        ) : (
          <div className="conditions-add-row">
            <Select
              value={selectedKey}
              aria-label="Выберите состояние"
              onChange={(event) => setNewCondition(event.target.value)}
            >
              {inactive.map((entry) => (
                <option key={entry.key} value={entry.key}>
                  {entry.label}
                </option>
              ))}
            </Select>
            <Button
              icon="plus"
              iconOnly
              variant="soft"
              aria-label="Наложить выбранное состояние"
              title="Наложить выбранное состояние"
              disabled={!selectedEntry}
              onClick={() => {
                if (selectedEntry) activate(selectedEntry.key, selectedEntry.state);
              }}
            />
          </div>
        )}
      </div>
    </Panel>
  );
}
