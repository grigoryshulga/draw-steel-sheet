import { useId, useMemo } from "react";
import { SKILL_GROUPS } from "../data/skills";
import { Icon } from "./Icons";
import type { SkillSlot } from "../data/creation-rules";
import {
  resolveSkillSelection,
  toggleSkillSelection,
} from "../lib/skill-selection";
import "./SkillPicker.css";

export interface SkillPickerProps {
  slots: SkillSlot[];
  values: string[];
  prior?: string[];
  onChange: (values: string[]) => void;
  label?: string;
}

const EMPTY_SKILLS: string[] = [];

function skillKey(skill: string): string {
  return skill.trim().toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ");
}

export function SkillPicker({
  slots,
  values,
  prior = EMPTY_SKILLS,
  onChange,
  label = "Выбор навыков",
}: SkillPickerProps) {
  const id = useId();
  const state = useMemo(
    () => resolveSkillSelection(slots, values, prior),
    [slots, values, prior],
  );
  const selected = useMemo(() => new Set(state.selected.map(skillKey)), [state.selected]);
  const automatic = useMemo(() => new Set(state.automatic.map(skillKey)), [state.automatic]);
  const known = useMemo(() => new Set(state.known.map(skillKey)), [state.known]);
  const available = useMemo(() => new Set(state.available.map(skillKey)), [state.available]);
  const selectable = useMemo(() => new Set(state.selectable.map(skillKey)), [state.selectable]);
  const hasUnavailableSkills = state.available.some(
    (skill) => !selected.has(skillKey(skill)) && !selectable.has(skillKey(skill)),
  );

  return (
    <section className="skill-picker" aria-labelledby={`${id}-title`}>
      <h3 className="skill-picker__title" id={`${id}-title`}>{label}</h3>

      <div className="skill-picker__summary" aria-live="polite">
        <p className="skill-picker__count">
          Выбрано {state.selected.length} из {state.required}, осталось {state.remaining}
        </p>
        {hasUnavailableSkills ? (
          <p className="skill-picker__hint">
            {state.remaining === 0
              ? "Лимит выбран. Снимите отметку с выбранного навыка, чтобы заменить его."
              : "Некоторые навыки недоступны при текущем выборе. Снимите отметку с навыка, чтобы заменить его."}
          </p>
        ) : null}
        {state.automatic.length > 0 ? (
          <p className="skill-picker__automatic-summary">
            Автоматически получено: {state.automatic.join(", ")} (не входят в выбор)
          </p>
        ) : null}
      </div>

      {state.requirements.length > 0 ? (
        <ul className="skill-picker__requirements" aria-label="Требования по группам навыков">
          {state.requirements.map((requirement, index) => (
            <li key={`${requirement.label}:${index}`}>
              <span>{requirement.label}</span>
              <span>{requirement.selected} из {requirement.required}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {slots.length === 0 ? (
        <p className="skill-picker__message">
          Сначала выберите происхождение, культуру, карьеру или класс, чтобы увидеть доступные навыки.
        </p>
      ) : null}

      <div className="skill-picker__groups">
        {SKILL_GROUPS.map((group, groupIndex) => {
          const relevantSkills = group.skills.filter((skill) => {
            const key = skillKey(skill);
            return available.has(key) || automatic.has(key) || known.has(key);
          });
          if (relevantSkills.length === 0) return null;

          return (
            <fieldset className="skill-picker__group" key={group.key}>
              <legend>{group.label}</legend>
              <div className="skill-picker__chips">
                {relevantSkills.map((skill, skillIndex) => {
                  const key = skillKey(skill);
                  const isSelected = selected.has(key);
                  const isAutomatic = automatic.has(key);
                  const isKnown = known.has(key);
                  const canAdd = selectable.has(key);
                  const locked = isAutomatic || isKnown;
                  const unavailable = !locked && !isSelected && !canAdd;
                  const reason = isAutomatic
                    ? "Получен автоматически; повторно выбрать нельзя."
                    : isKnown
                      ? "Уже известен из предыдущего шага; повторно выбрать нельзя."
                      : unavailable && state.remaining === 0
                        ? "Все выборы уже использованы."
                        : unavailable
                          ? "Этот навык нельзя добавить при текущем наборе."
                          : undefined;
                  const checkboxId = `${id}-g${groupIndex}-s${skillIndex}`;
                  const reasonId = `${checkboxId}-reason`;

                  return (
                    <span
                      className={`skill-picker__chip${isSelected ? " is-selected" : ""}${locked ? " is-locked" : ""}${unavailable ? " is-unavailable" : ""}`}
                      key={skill}
                    >
                      <input
                        className="skill-picker__checkbox"
                        id={checkboxId}
                        type="checkbox"
                        checked={isSelected || isAutomatic || isKnown}
                        disabled={locked || unavailable}
                        aria-describedby={reason ? reasonId : undefined}
                        onChange={() => onChange(toggleSkillSelection(slots, values, prior, skill))}
                      />
                      <label htmlFor={checkboxId}>
                        <span className="skill-picker__skill-name">
                          {skill}
                          {isSelected ? <Icon name="check" size={14} aria-hidden="true" /> : null}
                        </span>
                        {isAutomatic ? <span className="skill-picker__status">Автоматически</span> : null}
                        {isKnown ? <span className="skill-picker__status">Уже есть</span> : null}
                        {reason ? (
                          <span className="skill-picker__sr-only" id={reasonId}>{reason}</span>
                        ) : null}
                      </label>
                    </span>
                  );
                })}
              </div>
            </fieldset>
          );
        })}
      </div>

      {state.invalid.length > 0 ? (
        <p className="skill-picker__error" role="alert">
          В сохранённом выборе есть недопустимые навыки: {state.invalid.join(", ")}. Измените выбор, чтобы исправить его.
        </p>
      ) : null}
    </section>
  );
}
