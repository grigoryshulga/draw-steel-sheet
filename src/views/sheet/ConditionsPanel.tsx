import { useState } from "react";
import { Button, Panel, Select } from "../../components/ui";
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

/** Состояния героя: активные карточки и форма наложения. */
export function ConditionsPanel() {
  const { character, patch, notify } = useApp();
  const [newCondition, setNewCondition] = useState("");
  const [newEnd, setNewEnd] = useState<ConditionEnd>("save");
  const [lastSaveRoll, setLastSaveRoll] = useState<Record<string, string>>({});
  const [compact, setCompact] = useState(false);
  const saveBonus = featureStatBonus(character, "save");
  const saveContributions = featureStatContributions(character, "save");
  const saveSources = saveContributions.map((contribution) => contribution.sourceName).join(", ");

  const entries = CONDITIONS.map((condition) => {
    const state = character.conditions[condition.key] ?? INACTIVE;
    const endLabel = CONDITION_END_OPTIONS.find((option) => option.key === state.ends)?.label ?? state.ends;
    return { ...condition, state, endLabel };
  });
  const active = entries.filter((entry) => entry.state.active);
  const inactive = entries.filter((entry) => !entry.state.active);
  const selectedKey = inactive.some((entry) => entry.key === newCondition)
    ? newCondition
    : (inactive[0]?.key ?? "");
  const selectedEntry = inactive.find((entry) => entry.key === selectedKey);

  const setCondition = (key: string, state: ConditionState) => {
    patch({ conditions: { ...character.conditions, [key]: state } });
  };

  const activate = (key: string) => {
    setCondition(key, { active: true, ends: newEnd });
    setNewEnd("save");
  };

  const deactivate = (key: string, state: ConditionState) => {
    setCondition(key, { ...state, active: false });
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
      className={`conditions-panel${compact ? " is-compact" : ""}`}
      actions={(
        <>
          {saveBonus !== 0 && (
            <span className="chip chip-static chip-accent" title={saveSources || undefined}>
              Спасбросок {saveBonus > 0 ? "+" : "−"}{Math.abs(saveBonus)}
            </span>
          )}
          {active.length > 0 && (
            <Button size="sm" variant="ghost" icon={compact ? "plus" : "minus"} iconOnly
              aria-label={compact ? "Развернуть карточки состояний" : "Свернуть карточки состояний до заголовков"}
              aria-expanded={!compact}
              title={compact ? "Развернуть карточки" : "Свернуть карточки до заголовков"}
              onClick={() => setCompact((value) => !value)} />
          )}
          <span className="condition-count" aria-label={`Активных состояний: ${active.length}`}>{active.length}</span>
        </>
      )}
      dense
    >
      <div className="conditions-active">
        {active.length === 0 ? (
          <p className="conditions-empty">Нет активных состояний.</p>
        ) : (
          <div className="condition-active-list">
            {active.map((entry) => (
              <article className="condition-card" key={entry.key}>
                <header className="condition-card-head">
                  <h3
                    title={`Оканчивается: ${entry.endLabel}`}
                    aria-label={`${entry.label}. Оканчивается: ${entry.endLabel}`}
                  >
                    {entry.label}
                  </h3>
                  <Button
                    size="sm"
                    variant="soft"
                    icon="dice"
                    iconOnly
                    disabled={entry.state.ends !== "save"}
                    aria-label={`Спасбросок против состояния: ${entry.label}`}
                    onClick={() => rollSave(entry.key, entry.label, entry.state)}
                    title={entry.state.ends !== "save"
                      ? "Доступно для состояния до спасброска"
                      : lastSaveRoll[entry.key]
                        ? `Последний бросок: ${lastSaveRoll[entry.key]}`
                        : `Спасбросок: d10 + бонус ${saveBonus} ≥ ${SAVE_ENDS_TARGET}`}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    icon="close"
                    iconOnly
                    aria-label={`Снять состояние: ${entry.label}`}
                    title={`Снять состояние: ${entry.label}`}
                    onClick={() => deactivate(entry.key, entry.state)}
                  />
                </header>

                {!compact && (
                  <div className="condition-card-body">
                    <p className="condition-summary">{entry.summary}</p>
                  </div>
                )}
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
            <Select
              value={newEnd}
              aria-label="Когда оканчивается новое состояние"
              onChange={(event) => setNewEnd(event.target.value as ConditionEnd)}
            >
              {CONDITION_END_OPTIONS.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
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
                if (selectedEntry) activate(selectedEntry.key);
              }}
            />
          </div>
        )}
      </div>
    </Panel>
  );
}
