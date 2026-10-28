import { Fragment, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button, Select } from "../../components/ui";
import { Icon } from "../../components/Icons";
import {
  classFeatureChoicesForSheet,
  featureSheetChoiceState,
  conduitLegacyDomainChoicesForSheet,
  confirmConduitLegacyRewardsReviewed,
  setConduitDomainPair,
  setBloomingSaintImmunityChoice,
  withClassFeatureSelection,
  classFeatureGroupsForSheet,
  featureBadgeState,
  featureLevelOpenState,
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
      {item.badges.map((badge, index) => {
        const state = featureBadgeState(badge);
        return (
          <Fragment key={`${badge.kind}-${badge.label}`}>
            {index > 0 && (
              <li className="cf-badge-sep" aria-hidden="true">
                ·
              </li>
            )}
            <li
              className={`cf-badge is-${badge.kind}${badge.active ? "" : " is-off"}`}
              title={state ? `${badge.label} — ${state}` : badge.label}
            >
              <span className="cf-badge-text">{badge.label}</span>
              {state && <span className="cf-badge-state">{state}</span>}
            </li>
          </Fragment>
        );
      })}
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
      {item.summary && !item.summaryFromDescription && <p className="cf-item-summary">{item.summary}</p>}
      {trigger && (
        <p className="cf-item-trigger-detail">
          <span className="cf-item-note-label">Условие:</span> {trigger.detail}
        </p>
      )}
      {item.notes && (
        <p className="cf-item-mechanics-notes">
          <span className="cf-item-note-label">Примечание:</span> {item.notes}
        </p>
      )}
      {item.detail && (
        <details className="cf-item-detail">
          <summary>Текст особенности</summary>
          <div className="cf-item-markdown">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {item.detail}
            </ReactMarkdown>
          </div>
        </details>
      )}
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
 * механики, бейджи триггеров и условий, выбор аспекта/традиции/доктрины, если
 * он ещё не выбран. Единственный источник правил — новый реестр механик.
 */
export function ClassFeatureMechanicsPanel() {
  const { character, update } = useApp();
  const groups = classFeatureGroupsForSheet(character);
  const choices = classFeatureChoicesForSheet(character);
  const conduitState = conduitLegacyDomainChoicesForSheet(character);
  const triggers = triggerBadgeCounts(character);
  const hasTriggers = groups.some((group) =>
    group.features.some((item) => item.trigger),
  );
  const runtime = currentRuntime(character);
  // Раскрыта группа ровно текущего уровня героя; клики игрока переопределяют
  // только тронутые группы и переживают только собственный уровень.
  const [levelOverrides, setLevelOverrides] = useState<Record<number, boolean>>({});
  const [conduitDomainDraft, setConduitDomainDraft] = useState<[string, string]>(["", ""]);
  const openLevels = featureLevelOpenState(
    groups,
    character.level,
    levelOverrides,
  );

  if (groups.length === 0 && choices.length === 0 && !conduitState.message) return null;

  const toggle = (level: number) =>
    setLevelOverrides((current) => {
      const state = featureLevelOpenState(groups, character.level, current);
      return { ...current, [level]: !state[level] };
    });

  const selectChoice = (group: string, value: string) => {
    update((current) => {
      if (group === "conduit.blooming-saint-immunity") return setBloomingSaintImmunityChoice(current, value);
      // Аспект Неистового, орден Цензора и традиция Таланта живут ещё и в
      // `subclass`: без синхронизации выбор из панели не открывал бы
      // повышение уровня.
      return withClassFeatureSelection(current, group, value);
    });
  };

  const updateConduitDomain = (index: 0 | 1, value: string) => {
    const currentPair = conduitState.selectedDomains.length === 2 ? conduitState.selectedDomains : conduitDomainDraft;
    const next: [string, string] = [...currentPair] as [string, string];
    next[index] = value;
    setConduitDomainDraft(next);
    if (next[0] && next[1] && next[0] !== next[1]) {
      update((current) => setConduitDomainPair(current, next));
    }
  };

  return (
    <section className="cf-sheet" aria-label="Особенности класса по уровням">
      {choices.length > 0 && (
        <div className="cf-choices">
          {choices.map((choice) => (
            <label className="cf-choice" key={choice.group}>
              {(() => {
                const state = featureSheetChoiceState(choice);
                return <>
              <span className="cf-choice-label">{choice.label}</span>
              <Select
                value={state.selectedOption}
                aria-label={`${choice.label}: выберите вариант`}
                onChange={(event) => selectChoice(choice.group, event.target.value)}
              >
                <option value="">Не выбран</option>
                {choice.options.map((option) => (
                  <option key={option} value={option}>
                    {choice.optionLabels?.[option] ?? groupOptionLabel(choice.group, option)}
                  </option>
                ))}
              </Select>
              {state.warning && (
                <span className="cf-item-note">{state.warning}</span>
              )}
                </>;
              })()}
            </label>
          ))}
        </div>
      )}
      {conduitState.message && <div className="cf-choices">
        <p className="cf-choice-label">{conduitState.message}</p>
        {[0, 1].map((index) => (
          <label className="cf-choice" key={index}>
            <span className="cf-choice-label">{index === 0 ? "Первый домен" : "Второй домен"}</span>
            <Select aria-label={index === 0 ? "Первый домен Проводника" : "Второй домен Проводника"} value={conduitDomainDraft[index as 0 | 1]} onChange={(event) => updateConduitDomain(index as 0 | 1, event.target.value)}>
              <option value="">Выберите домен</option>
              {conduitState.domains.map((domain) => <option key={domain} value={domain}>{domain}</option>)}
            </Select>
          </label>
        ))}
      </div>}
      {conduitState.legacyWarning && <div className="cf-choices">
        <p className="cf-item-note">{conduitState.legacyWarning}</p>
        <Button size="sm" variant="soft" onClick={() => update((current) => confirmConduitLegacyRewardsReviewed(current))}>Я проверил награды</Button>
      </div>}

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
            open={openLevels[group.level] ?? false}
            onToggle={() => toggle(group.level)}
          />
        ))}
      </div>
    </section>
  );
}

function groupOptionLabel(group: string, option: string): string {
  if (group === "conduit.prayer" || group === "conduit.sanctuary") {
    const labels: Record<string, string> = {
      "conduit.prayer.destruction": "Молитва о разрушении",
      "conduit.prayer.distance": "Молитва о дистанции",
      "conduit.prayer.soldier": "Молитва о мастерстве солдата",
      "conduit.prayer.speed": "Молитва о скорости",
      "conduit.prayer.steel": "Молитва о стали",
      "conduit.sanctuary.bastion": "Оберег бастиона",
      "conduit.sanctuary.reaction": "Оберег реакции",
      "conduit.sanctuary.refuge": "Оберег святилища",
      "conduit.sanctuary.spirits": "Оберег духов",
    };
    return labels[option] ?? option;
  }
  if (group !== "conduit.blooming-saint-immunity") return option;
  return option === "corruption" ? "Порча 10" : option === "holy" ? "Святой 10" : "Не выбран";
}
