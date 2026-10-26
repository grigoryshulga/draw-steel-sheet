import { useState } from "react";
import { Button, Select } from "../../components/ui";
import { Icon } from "../../components/Icons";
import {
  classFeatureChoicesForSheet,
  classFeatureGroupsForSheet,
  triggerBadgeCounts,
  type FeatureSheetGroup,
  type FeatureSheetItem,
} from "../../lib/class-feature-view";
import { currentRuntime } from "../../lib/runtime";
import { useApp } from "../../state/AppContext";
import "./ClassFeaturesPanel.css";

/** Подпись кнопки отметки: «раз за схватку» получают, остальные — используют. */
function markLabel(item: FeatureSheetItem): string {
  if (!item.trigger) return "Отметить";
  if (item.trigger.used) return "Снять";
  return item.trigger.frequency === "encounter" ? "получено" : "использовано";
}

/**
 * Кнопки «Новый раунд» и «Новая схватка» для шапки панели особенностей.
 * Действия идут через журнал игры, поэтому их можно отменить в истории.
 */
export function RoundEncounterControls({ className = "" }: { className?: string }) {
  const { character, performGameAction } = useApp();
  const runtime = currentRuntime(character);
  return (
    <div className={`cf-turn ${className}`.trim()}>
      <Button
        size="sm"
        variant="soft"
        onClick={() => performGameAction({ kind: "round" })}
        title="Новый раунд: номер растёт, отметки триггеров раунда снимаются"
      >
        Новый раунд · {runtime.round}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => performGameAction({ kind: "encounter" })}
        title="Новая схватка: номер растёт, все отметки триггеров снимаются"
      >
        Новая схватка · {runtime.encounter}
      </Button>
    </div>
  );
}

/** Бейджи записи: срабатывание, порог, иммунитет, выбор, выдача. */
function Badges({ item }: { item: FeatureSheetItem }) {
  if (item.badges.length === 0) return null;
  return (
    <ul className="cf-badges">
      {item.badges.map((badge) => (
        <li
          key={`${badge.kind}-${badge.label}`}
          className={`cf-badge is-${badge.kind}${badge.active ? "" : " is-off"}`}
          title={
            badge.active
              ? undefined
              : "Условие сейчас не выполнено — механика ждёт своего состояния"
          }
        >
          {badge.label}
        </li>
      ))}
    </ul>
  );
}

/** Одна особенность: название, числа механики, бейджи и отметка триггера. */
function FeatureRow({ item }: { item: FeatureSheetItem }) {
  const { performGameAction } = useApp();
  const trigger = item.trigger;
  return (
    <article className={`cf-item${trigger?.used ? " is-used" : ""}`}>
      <div className="cf-item-head">
        <strong className="cf-item-name">{item.name}</strong>
        {trigger && (
          <Button
            size="sm"
            variant={trigger.used ? "ghost" : "soft"}
            aria-pressed={trigger.used}
            aria-label={`${trigger.used ? "Снять отметку" : "Отметить срабатывание"}: ${trigger.label}`}
            onClick={() =>
              performGameAction({
                kind: "trigger",
                featureId: item.id,
                used: !trigger.used,
              })
            }
            title={trigger.label}
          >
            {markLabel(item)}
          </Button>
        )}
      </div>
      {item.summary && <p className="cf-item-summary">{item.summary}</p>}
      <Badges item={item} />
      {trigger?.used && trigger.count > 1 && (
        <span className="cf-item-note">
          {trigger.frequency === "encounter"
            ? `отмечено в этой схватке: ${trigger.count}`
            : `отмечено в этом раунде: ${trigger.count}`}
        </span>
      )}
    </article>
  );
}

/** Группа уровня: свёрнута, кроме текущего уровня героя. */
function LevelGroup({
  group,
  open,
  onToggle,
}: {
  group: FeatureSheetGroup;
  open: boolean;
  onToggle: () => void;
}) {
  const triggers = group.features.filter((item) => item.trigger && !item.trigger.used)
    .length;
  return (
    <section className="cf-group">
      <button
        type="button"
        className="cf-group-head"
        aria-expanded={open}
        onClick={onToggle}
      >
        <Icon name={open ? "chevron-down" : "chevron-right"} size={13} />
        <span className="cf-group-title">{group.title}</span>
        <span className="cf-group-count">{group.features.length}</span>
        {triggers > 0 && (
          <span className="cf-group-triggers" title="Доступные срабатывания">
            {triggers}
          </span>
        )}
      </button>
      {open && (
        <div className="cf-items">
          {group.features.map((item) => (
            <FeatureRow key={item.id} item={item} />
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * Панель активных особенностей класса на листе: группы по уровням, числа
 * механики, бейджи триггеров и условий, выбор аспекта, если он ещё не выбран.
 *
 * Старый реестр выборов (`classFeature-rules`) живёт ниже в панели героя и
 * продолжает обслуживать четыре класса, у которых механики пока нет.
 */
export function ClassFeatureMechanicsPanel() {
  const { character, update } = useApp();
  const groups = classFeatureGroupsForSheet(character);
  const choices = classFeatureChoicesForSheet(character);
  const triggers = triggerBadgeCounts(character);
  const hasTriggers = groups.some((group) =>
    group.features.some((item) => item.trigger),
  );
  const runtime = currentRuntime(character);
  const currentLevel =
    groups.length > 0 ? groups[groups.length - 1].level : character.level;
  const [expanded, setExpanded] = useState<number[] | null>(null);
  const openLevels = expanded ?? [currentLevel];

  if (groups.length === 0 && choices.length === 0) return null;

  const toggle = (level: number) => {
    const next = openLevels.includes(level)
      ? openLevels.filter((item) => item !== level)
      : [...openLevels, level];
    setExpanded(next);
  };

  const selectChoice = (group: string, value: string) => {
    update((current) => {
      const automation = current.automation ?? {
        enabled: false,
        adjustments: {},
        ancestryTraits: [],
      };
      const classFeatureSelections = { ...automation.classFeatureSelections };
      if (value) classFeatureSelections[group] = value;
      else delete classFeatureSelections[group];
      return {
        ...current,
        automation: { ...automation, classFeatureSelections },
      };
    });
  };

  return (
    <section className="cf-sheet" aria-label="Особенности класса по уровням">
      {choices.length > 0 && (
        <div className="cf-choices">
          {choices.map((choice) => (
            <label className="cf-choice" key={choice.group}>
              <span className="cf-choice-label">{choice.label}</span>
              <Select
                value=""
                aria-label={`${choice.label}: выберите вариант`}
                onChange={(event) => selectChoice(choice.group, event.target.value)}
              >
                <option value="">Не выбран</option>
                {choice.options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
            </label>
          ))}
        </div>
      )}

      <div className="cf-status">
        <span>
          Раунд {runtime.round} · схватка {runtime.encounter}
        </span>
        {hasTriggers && (
          <span
            className={
              triggers > 0 ? "cf-status-triggers is-live" : "cf-status-triggers"
            }
          >
            {triggers > 0
              ? `Доступно срабатываний: ${triggers}`
              : "Все срабатывания отмечены"}
          </span>
        )}
      </div>

      <div className="cf-groups">
        {groups.map((group) => (
          <LevelGroup
            key={group.level}
            group={group}
            open={openLevels.includes(group.level)}
            onToggle={() => toggle(group.level)}
          />
        ))}
      </div>
    </section>
  );
}
