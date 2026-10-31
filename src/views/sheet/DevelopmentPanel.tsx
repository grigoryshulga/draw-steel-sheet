import { useCallback, useEffect, useMemo, useState } from "react";
import "./DevelopmentPanel.css";
import { AbilityCard } from "../../components/AbilityCard";
import { PerkCard } from "../../components/PerkCard";
import { Icon } from "../../components/Icons";
import { PerkDetailModal } from "../../components/PerkDetailModal";
import { Button, Chip, Modal } from "../../components/ui";
import { ALL_PERK_TYPES, PERK_TYPE_META } from "../../data/perks";
import type { PerkType } from "../../types";
import {
  applyDevelopment,
  buildDevelopmentPlan,
  developmentIssues,
  draftIsDirty,
  nextLevelEngaged,
  skillChipMeta,
  stepSelection,
  type DevelopmentDraft,
  type DevelopmentLevel,
  type DevelopmentOption,
  type DevelopmentPlan,
  type DevelopmentStep,
} from "../../lib/development";
import { useApp } from "../../state/AppContext";
import {
  ClassFeatureChoices,
  FeatureRow,
} from "./ClassFeaturesPanel";

interface DetailState {
  option: DevelopmentOption;
  step: DevelopmentStep;
}

interface DevelopmentPanelProps {
  /** Черновик разошёлся с героем: вкладку нельзя покинуть молча. */
  onDirtyChange?: (dirty: boolean) => void;
}

type PerkGroupKey = PerkType | "other";

const PERK_GROUP_ORDER: PerkGroupKey[] = [...ALL_PERK_TYPES, "other"];

/** Перки в шаге уровня группируются по типу, сохраняя порядок типов. */
function groupPerkOptions(options: DevelopmentOption[]) {
  const byType = new Map<PerkGroupKey, DevelopmentOption[]>();
  for (const option of options) {
    const key: PerkGroupKey = option.perkType ?? "other";
    const list = byType.get(key) ?? [];
    list.push(option);
    byType.set(key, list);
  }
  return PERK_GROUP_ORDER.filter((key) => byType.has(key)).map((key) => ({
    key,
    options: byType.get(key)!,
  }));
}

const STATUS_LABEL: Record<DevelopmentLevel["status"], string> = {
  sealed: "Создание",
  applied: "Получен",
  next: "Следующий",
};

/** Сворачиваем всё, кроме последнего полученного уровня и следующего. */
function defaultClosedLevels(plan: DevelopmentPlan): Set<number> {
  const applied = plan.levels.filter((level) => level.status === "applied");
  const latest = applied.length > 0 ? applied[applied.length - 1].level : 0;
  return new Set(
    plan.levels
      .filter((level) => level.status !== "next" && level.level !== latest)
      .map((level) => level.level),
  );
}

function stepProgress(step: DevelopmentStep, selected: string[]): string {
  if (step.count === 1) return selected.length > 0 ? "1/1" : "0/1";
  return `${Math.min(selected.length, step.count)}/${step.count}`;
}

/** Вкладка «Развитие»: уровни, выборы внутри уровней и их реконфигурация. */
export function DevelopmentPanel({ onDirtyChange }: DevelopmentPanelProps) {
  const { character, update } = useApp();
  const plan = useMemo(() => buildDevelopmentPlan(character), [character]);
  const [draft, setDraft] = useState<DevelopmentDraft>({});
  const [detail, setDetail] = useState<DetailState | undefined>();
  const [closed, setClosed] = useState<Set<number>>(() => defaultClosedLevels(plan));
  const [notice, setNotice] = useState<string | undefined>();
  const [blocked, setBlocked] = useState<string | undefined>();
  const [closedPerkGroups, setClosedPerkGroups] = useState<Set<string>>(
    new Set(),
  );

  const input = { draft };
  const issues = developmentIssues(plan, input);
  const dirty = draftIsDirty(plan, draft);
  const engaged = nextLevelEngaged(plan, draft);
  const canSave = issues.length === 0 && (dirty || engaged);
  // Пока игрок не начал выборы следующего уровня, его незаполненные шаги —
  // не ошибка, а подсказка. Ошибки уже полученных уровней видны всегда.
  const visibleIssues = issues.filter(
    (issue) => dirty || engaged || issue.level !== plan.nextLevel?.level,
  );

  useEffect(() => {
    const valid = new Set(
      plan.levels.flatMap((level) => level.steps.map((step) => step.id)),
    );
    setDraft((previous) => {
      const keys = Object.keys(previous);
      if (keys.every((key) => valid.has(key))) return previous;
      const next: DevelopmentDraft = {};
      for (const key of keys) {
        if (valid.has(key)) next[key] = previous[key];
      }
      return next;
    });
  }, [plan]);

  useEffect(() => {
    onDirtyChange?.(dirty || engaged);
  }, [dirty, engaged, onDirtyChange]);

  const toggle = (step: DevelopmentStep, optionId: string) => {
    setNotice(undefined);
    setBlocked(undefined);
    const selected = stepSelection(step, draft);
    if (selected.includes(optionId)) {
      setDraft({ ...draft, [step.id]: selected.filter((id) => id !== optionId) });
      return;
    }
    if (step.count === 1) {
      setDraft({ ...draft, [step.id]: [optionId] });
      return;
    }
    if (selected.length >= step.count) {
      // Снять лишнее можно повторным нажатием по карточке: отказ не мешает
      // отмене выбора, только не даёт сохранить перебор.
      setBlocked(
        `В шаге «${step.title}» можно выбрать только ${step.count}. Снимите лишнее.`,
      );
      return;
    }
    setDraft({ ...draft, [step.id]: [...selected, optionId] });
  };

  const reset = useCallback(() => {
    setDraft({});
    setBlocked(undefined);
    setNotice("Черновик сброшен — вкладка снова показывает сохранённое состояние героя.");
  }, []);

  const save = useCallback(() => {
    const result = applyDevelopment(character, plan, input);
    if (!result.ok) {
      setNotice(undefined);
      setBlocked(result.issues[0]);
      return;
    }
    update(() => result.next);
    setDraft({});
    setBlocked(undefined);
    setClosed(defaultClosedLevels(buildDevelopmentPlan(result.next)));
    setNotice(
      result.leveledUp
        ? `Сохранено. Герой поднялся до ${result.next.level}-го уровня.`
        : "Сохранено.",
    );
  }, [character, plan, input, update]);

  const togglePerkGroup = (id: string) => {
    setClosedPerkGroups((previous) => {
      const next = new Set(previous);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  };

  const toggleLevel = (level: number) => {
    setClosed((previous) => {
      const next = new Set(previous);
      if (next.has(level)) next.delete(level);
      else next.add(level);
      return next;
    });
  };

  const nextLevelEntry = plan.levels.find((level) => level.status === "next");
  const nextSteps = (nextLevelEntry?.steps ?? [])
    .map((step) => ({
      step,
      selected: stepSelection(step, draft).length,
    }))
    .filter(({ step, selected }) => selected < step.count);

  // Сводка собирает всё, что уровень даст при сохранении: автоматические
  // награды и уже сделанные выборы — чтобы не выискивать их по секции.
  const summaryGrants = nextLevelEntry
    ? [
        ...nextLevelEntry.upcoming.map((feature) => ({
          id: `feature:${feature.id}`,
          name: feature.name,
          summary: feature.summary,
        })),
        ...nextLevelEntry.granted.map((grant) => ({
          id: `grant:${grant.id}`,
          name: grant.name,
          summary: grant.summary,
        })),
      ]
    : [];
  const summaryPicks = (nextLevelEntry?.steps ?? []).map((step) => ({
    step,
    labels: stepSelection(step, draft)
      .map((id) => step.options.find((option) => option.id === id)?.label)
      .filter((label): label is string => !!label),
  }));

  return (
    <div className="dev-panel">
      <header className="dev-head">
        <div className="dev-head-text">
          <h2 className="dev-title">Развитие</h2>
        </div>
        <div className="dev-head-actions">
          <Button
            size="sm"
            variant="ghost"
            onClick={reset}
            disabled={!dirty && !engaged}
          >
            Сбросить
          </Button>
          <Button size="sm" variant="primary" onClick={save} disabled={!canSave}>
            Сохранить
          </Button>
        </div>
      </header>

      {(notice || blocked || visibleIssues.length > 0) && (
        <div className="dev-savebar" role="status">
          {notice && <p className="dev-note is-ok">{notice}</p>}
          {blocked && <p className="dev-note is-error">{blocked}</p>}
          {visibleIssues.length > 0 && (
            <ul className="dev-issues">
              {visibleIssues.slice(0, 4).map((issue) => (
                <li key={`${issue.level}-${issue.stepId ?? issue.message}`}>
                  {issue.message}
                </li>
              ))}
              {visibleIssues.length > 4 && (
                <li>…и ещё {visibleIssues.length - 4}</li>
              )}
            </ul>
          )}
          {dirty && visibleIssues.length === 0 && (
            <p className="dev-note">Черновик готов — сохраните, чтобы применить.</p>
          )}
        </div>
      )}

      {nextLevelEntry &&
        (summaryGrants.length > 0 ||
          summaryPicks.length > 0 ||
          nextSteps.length > 0) && (
        <section
          className="dev-summary"
          aria-label={`Что даст ${nextLevelEntry.title}`}
        >
          <div className="dev-summary-head">
            <span className="eyebrow">Сводка повышения</span>
            <span className="dev-summary-title">{nextLevelEntry.title}</span>
            <span className="dev-summary-echelon mono">
              {nextLevelEntry.echelonLabel}
            </span>
            {nextLevelEntry.ruleTitle && (
              <span className="dev-summary-rule">{nextLevelEntry.ruleTitle}</span>
            )}
          </div>

          {summaryGrants.length > 0 && (
            <div className="dev-summary-block">
              <span className="dev-block-title">Выдаётся автоматически</span>
              <ul className="dev-list">
                {summaryGrants.map((item) => (
                  <li key={item.id}>
                    <strong>{item.name}</strong>
                    {item.summary && <span> — {item.summary}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {summaryPicks.length > 0 && (
            <div className="dev-summary-block">
              <span className="dev-block-title">Ваши выборы</span>
              <ul className="dev-list dev-summary-picks">
                {summaryPicks.map(({ step, labels }) => (
                  <li key={step.id}>
                    <strong>{step.title}:</strong>{" "}
                    {labels.length > 0 ? (
                      labels.join(", ")
                    ) : (
                      <span className="dev-summary-empty">не выбрано</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {nextSteps.length > 0 && (
            <div className="dev-summary-block">
              <span className="dev-block-title">Осталось выбрать</span>
              <div className="dev-todo-list">
                {nextSteps.map(({ step, selected }) => (
                  <button
                    type="button"
                    key={step.id}
                    className="dev-todo-item"
                    onClick={() =>
                      document
                        .getElementById(`dev-step-${step.id}`)
                        ?.scrollIntoView({ behavior: "smooth", block: "start" })
                    }
                  >
                    <span>{step.title}</span>
                    <span className="mono">
                      {selected}/{step.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      <div className="dev-class-choices">
        <ClassFeatureChoices />
      </div>

      <div className="dev-levels">
        {plan.levels.map((level) => {
          const isClosed = closed.has(level.level);
          // Считаем и подсказку следующего уровня: игрок видит, сколько шагов
          // ещё не заполнено, даже пока сохранение ничего не блокирует.
          const incomplete = level.steps.filter(
            (step) => stepSelection(step, draft).length < step.count,
          ).length;
          return (
            <section
              key={level.level}
              className={`dev-level${isClosed ? " is-closed" : ""}`}
              data-status={level.status}
            >
              <button
                type="button"
                className="dev-level-head"
                onClick={() => toggleLevel(level.level)}
                aria-expanded={!isClosed}
              >
                <Icon name={isClosed ? "chevron-right" : "chevron-down"} size={18} />
                <span className="dev-level-number mono">{level.level}</span>
                <span className="dev-level-title">{level.title}</span>
                <span className="dev-level-echelon mono">{level.echelonLabel}</span>
                <span className="dev-level-status">{STATUS_LABEL[level.status]}</span>
                {incomplete > 0 && (
                  <span className="dev-level-incomplete">
                    {incomplete} не заполнено
                  </span>
                )}
              </button>

              {!isClosed && (
                <div className="dev-level-body">
                  {level.ruleTitle && (
                    <p className="dev-level-rule">{level.ruleTitle}</p>
                  )}
                  {level.note && <p className="dev-note">{level.note}</p>}

                  {level.fixed.length > 0 && (
                    <div className="dev-fixed">
                      {level.fixed.map((row) => (
                        <div key={row.label} className="dev-fixed-row">
                          <span className="dev-fixed-label">{row.label}</span>
                          <span className="dev-fixed-values">{row.values.join(" · ")}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {level.steps.map((step) => {
                    const selected = stepSelection(step, draft);
                    const complete = selected.length === step.count;
                    return (
                      <div
                        key={step.id}
                        id={`dev-step-${step.id}`}
                        className={`dev-step${complete ? " is-complete" : ""}`}
                      >
                        <div className="dev-step-head">
                          <span className="dev-step-title">{step.title}</span>
                          {step.hint && <span className="dev-step-hint">{step.hint}</span>}
                          <span className="dev-step-count mono">
                            {stepProgress(step, selected)}
                          </span>
                        </div>
                        {step.kind === "ability" ? (
                          <div className="dev-cards">
                            {step.options.map((option) => {
                              const isSelected = selected.includes(option.id);
                              if (!option.ability) return null;
                              return (
                                <AbilityCard
                                  key={option.id}
                                  ability={option.ability}
                                  character={character}
                                  selected={isSelected}
                                  onSelect={() => toggle(step, option.id)}
                                  origin={
                                    option.tag?.startsWith("Домен")
                                      ? { label: option.tag }
                                      : null
                                  }
                                  onOpen={() => setDetail({ option, step })}
                                />
                              );
                            })}
                          </div>
                        ) : step.kind === "perk" ? (
                          <div className="dev-perk-groups">
                            {groupPerkOptions(step.options).map(
                              ({ key, options }) => {
                                const groupId = `${step.id}:${key}`;
                                const collapsed =
                                  closedPerkGroups.has(groupId);
                                const meta =
                                  key === "other"
                                    ? null
                                    : PERK_TYPE_META[key];
                                return (
                                  <section
                                    className="dev-perk-group"
                                    key={key}
                                  >
                                    <button
                                      type="button"
                                      className="dev-perk-group-head"
                                      aria-expanded={!collapsed}
                                      onClick={() => togglePerkGroup(groupId)}
                                    >
                                      <Icon
                                        name={
                                          collapsed
                                            ? "chevron-right"
                                            : "chevron-down"
                                        }
                                        size={14}
                                      />
                                      <span className="dev-perk-group-name">
                                        {meta?.label ?? "Другие"}
                                      </span>
                                      <span className="dev-perk-group-count mono">
                                        {options.length}
                                      </span>
                                      <span
                                        className={`dev-perk-group-dot tone-${meta?.tone ?? "default"}`}
                                        aria-hidden="true"
                                      />
                                    </button>
                                    {!collapsed && (
                                      <div className="dev-perk-group-grid">
                                        {options.map((option) => {
                                          const isSelected = selected.includes(
                                            option.id,
                                          );
                                          return (
                                            <PerkCard
                                              key={option.id}
                                              eyebrow={step.hint ?? "Перк"}
                                              name={option.label}
                                              type={option.perkType}
                                              summary={option.summary}
                                              selected={isSelected}
                                              onSelect={() =>
                                                toggle(step, option.id)
                                              }
                                              onOpen={() =>
                                                setDetail({ option, step })
                                              }
                                            />
                                          );
                                        })}
                                      </div>
                                    )}
                                  </section>
                                );
                              },
                            )}
                          </div>
                        ) : (
                          <div className="dev-chips">
                            {step.options.map((option) => {
                              const isSelected = selected.includes(option.id);
                              const meta =
                                step.kind === "skill"
                                  ? skillChipMeta(option.label)
                                  : undefined;
                              return (
                                <Chip
                                  key={option.id}
                                  active={isSelected}
                                  tone={meta ? meta.tone : "accent"}
                                  title={option.summary ?? option.tag}
                                  onClick={() => toggle(step, option.id)}
                                >
                                  {option.label}
                                </Chip>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {level.status !== "next" && level.granted.length > 0 && (
                    <div className="dev-block">
                      <span className="dev-block-title">Выдаётся автоматически</span>
                      <ul className="dev-list">
                        {level.granted.map((grant) => (
                          <li key={grant.id}>
                            <strong>{grant.name}</strong>
                            {grant.summary && <span> — {grant.summary}</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {level.status !== "next" && level.upcoming.length > 0 && (
                    <div className="dev-block">
                      <span className="dev-block-title">Появятся особенности</span>
                      <ul className="dev-list">
                        {level.upcoming.map((feature) => (
                          <li key={feature.id}>
                            <strong>{feature.name}</strong>
                            {feature.summary && <span> — {feature.summary}</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {level.features.length > 0 && (
                    <div className="dev-block">
                      <span className="dev-block-title">Особенности класса</span>
                      <div className="cf-items dev-features">
                        {level.features.map((feature) => (
                          <FeatureRow key={feature.id} item={feature} />
                        ))}
                      </div>
                    </div>
                  )}

                  {level.status === "next" && level.steps.length === 0 && level.note && (
                    <p className="dev-note is-error">{level.note}</p>
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>

      {detail?.option.ability ? (
        <Modal
          open
          onClose={() => setDetail(undefined)}
          title="Способность"
          wide
          footer={
            <div className="dev-detail-footer">
              <Button variant="soft" onClick={() => setDetail(undefined)}>
                Закрыть
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  toggle(detail.step, detail.option.id);
                  setDetail(undefined);
                }}
              >
                {stepSelection(detail.step, draft).includes(detail.option.id)
                  ? "Снять выбор"
                  : "Выбрать"}
              </Button>
            </div>
          }
        >
          <AbilityCard
            ability={detail.option.ability}
            character={character}
            full
            flat
          />
        </Modal>
      ) : detail ? (
        <PerkDetailModal
          open
          onClose={() => setDetail(undefined)}
          name={detail.option.label}
          type={detail.option.perkType}
          eyebrow={detail.step.hint}
          summary={detail.option.summary}
          description={detail.option.detail}
        />
      ) : null}
    </div>
  );
}
