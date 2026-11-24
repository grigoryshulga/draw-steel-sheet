import { useLocale } from "../i18n/locale";
import { useId, useMemo } from "react";
import { SKILL_GROUPS, SKILL_GROUP_TONES, SKILL_ORIGINALS } from "../data/skills";
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
  hideTitle?: boolean;
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
  hideTitle = false,
}: SkillPickerProps) {
  const { locale, t } = useLocale();
  const name = (skill: string) => locale === "en" ? SKILL_ORIGINALS[skill]?.originalName || skill : skill;
  const groupNames: Record<string, string> = { crafting: "Crafting", exploration: "Exploration", interpersonal: "Interpersonal", intrigue: "Intrigue", lore: "Lore" };
  const requirementLabel = (label: string) => {
    if (locale !== "en") return label;
    const replacement = label.match(/^Любой навык взамен «(.+)»$/);
    if (replacement) return `Any skill replacing “${name(replacement[1])}”`;
    const group = SKILL_GROUPS.find((entry) => entry.label === label);
    if (group) return groupNames[group.key];
    return name(label);
  };
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
  return (
    <section className="skill-picker" aria-labelledby={`${id}-title`}>
      <h3 className={hideTitle ? "sr-only" : "skill-picker__title"} id={`${id}-title`}>{locale === "en" && label === "Выбор навыков" ? "Choose skills" : label}</h3>
      {state.required > 0 && <div className="skill-picker__summary">
        <strong role="status">{t(`Выбрано ${state.selected.length} из ${state.required}`, `Selected ${state.selected.length} of ${state.required}`)}</strong>
        <ul className="skill-picker__requirements" aria-label={t("Условия выбора навыков", "Skill selection requirements")}>
          {state.requirements.map(({ label, required, selected }, index) => (
            <li key={index}>
              <span>{requirementLabel(label)}</span>
              <span className="numeric">{t(`Осталось ${required - selected} из ${required}`, `${required - selected} of ${required} remaining`)}</span>
            </li>
          ))}
        </ul>
      </div>}

      {state.automatic.length > 0 ? (
        <p className="skill-picker__automatic-summary">
          {t("Автоматически получено", "Granted automatically")}: {state.automatic.map(name).join(", ")} {t("(не входят в выбор)", "(do not count toward choices)")}
        </p>
      ) : null}

      {slots.length === 0 ? (
        <p className="skill-picker__message">
          {t("Сначала выберите происхождение, культуру, карьеру или класс, чтобы увидеть доступные навыки.", "Choose an ancestry, culture, career, or class first to see available skills.")}
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
            <fieldset
              className="skill-picker__group"
              data-tone={SKILL_GROUP_TONES[group.key]}
              key={group.key}
            >
              <legend className="sr-only">{locale === "en" ? groupNames[group.key] : group.label}</legend>
              <div className="skill-picker__group-head">
                <span className="skill-picker__group-name">{locale === "en" ? groupNames[group.key] : group.label}</span>

              </div>
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
                    ? t("Получен автоматически; повторно выбрать нельзя.", "Granted automatically; cannot be selected again.")
                    : isKnown
                      ? t("Уже известен из предыдущего шага; повторно выбрать нельзя.", "Already known from an earlier step; cannot be selected again.")
                      : unavailable && state.remaining === 0
                        ? t("Все выборы уже использованы.", "All choices have been used.")
                        : unavailable
                          ? t("Этот навык нельзя добавить при текущем наборе.", "This skill cannot be added with the current choices.")
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
                          {name(skill)}
                          {isSelected ? <Icon name="check" size={14} aria-hidden="true" /> : null}
                        </span>
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
          {t("В сохранённом выборе есть недопустимые навыки", "The saved selection contains invalid skills")}: {state.invalid.map(name).join(", ")}. {t("Измените выбор, чтобы исправить его.", "Change the selection to fix it.")}
        </p>
      ) : null}
    </section>
  );
}
