import { useCallback, useEffect, useMemo, useState } from "react";
import "./DevelopmentPanel.css";
import { AbilityCard } from "../../components/AbilityCard";
import { Icon } from "../../components/Icons";
import { RichText } from "../../components/RichText";
import { Button, Chip, Modal } from "../../components/ui";
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
  ClassFeatureRuntimeStatus,
  FeatureRow,
  RoundEncounterControls,
} from "./ClassFeaturesPanel";

interface DetailState {
  option: DevelopmentOption;
  step: DevelopmentStep;
}

interface DevelopmentPanelProps {
  /** Черновик разошёлся с героем: вкладку нельзя покинуть молча. */
  onDirtyChange?: (dirty: boolean) => void;
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
  const [mode, setMode] = useState<"xp" | "milestone">("milestone");
  const [reviewed, setReviewed] = useState(false);
  const [detail, setDetail] = useState<DetailState | undefined>();
  const [closed, setClosed] = useState<Set<number>>(() => defaultClosedLevels(plan));
  const [notice, setNotice] = useState<string | undefined>();
  const [blocked, setBlocked] = useState<string | undefined>();

  const input = { draft, mode, reviewedRules: reviewed };
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

  const toggle = useCallback(
    (step: DevelopmentStep, optionId: string) => {
      setNotice(undefined);
      setBlocked(undefined);
      setDraft((previous) => {
        const selected = stepSelection(step, previous);
        const has = selected.includes(optionId);
        let nextSelected: string[];
        if (has) {
          nextSelected = selected.filter((id) => id !== optionId);
        } else if (step.count === 1) {
          nextSelected = [optionId];
        } else if (selected.length >= step.count) {
          setBlocked(
            `В шаге «${step.title}» можно выбрать только ${step.count}. Снимите лишнее.`,
          );
          return previous;
        } else {
          nextSelected = [...selected, optionId];
        }
        return { ...previous, [step.id]: nextSelected };
      });
    },
    [],
  );

  const reset = useCallback(() => {
    setDraft({});
    setReviewed(false);
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
    setReviewed(false);
    setBlocked(undefined);
    setClosed(defaultClosedLevels(buildDevelopmentPlan(result.next)));
    setNotice(
      result.leveledUp
        ? `Сохранено. Герой поднялся до ${result.next.level}-го уровня.`
        : "Сохранено.",
    );
  }, [character, plan, input, update]);

  const toggleLevel = (level: number) => {
    setClosed((previous) => {
      const next = new Set(previous);
      if (next.has(level)) next.delete(level);
      else next.add(level);
      return next;
    });
  };

  const nextLevel = plan.nextLevel;

  return (
    <div className="dev-panel">
      <header className="dev-head">
        <div className="dev-head-text">
          <h2 className="dev-title">Развитие</h2>
          <p className="dev-subtitle">
            Уровни и выборы внутри них. На отдыхе способности можно пересобрать:
            правьте шаги и сохраняйте готовое.
          </p>
        </div>
        <div className="dev-head-actions">
          <Button
            size="sm"
            variant="ghost"
            onClick={reset}
            disabled={!dirty && !engaged && !reviewed}
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

      <div className="dev-class-bar">
        <ClassFeatureRuntimeStatus />
        <RoundEncounterControls />
      </div>

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
                        className={`dev-step${complete ? " is-complete" : ""}`}
                      >
                        <div className="dev-step-head">
                          <span className="dev-step-title">{step.title}</span>
                          {step.hint && <span className="dev-step-hint">{step.hint}</span>}
                          <span className="dev-step-count mono">
                            {stepProgress(step, selected)}
                          </span>
                        </div>
                        {step.kind === "ability" || step.kind === "perk" ? (
                          <div className="dev-cards">
                            {step.options.map((option) => {
                              const isSelected = selected.includes(option.id);
                              return (
                                <article
                                  key={option.id}
                                  className={`dev-card${isSelected ? " is-selected" : ""}`}
                                >
                                  <button
                                    type="button"
                                    className="dev-card-title"
                                    onClick={() => setDetail({ option, step })}
                                    aria-label={`Открыть: ${option.label}`}
                                  >
                                    <span className="dev-card-name">{option.label}</span>
                                    {option.tag && (
                                      <span className="dev-card-tag">{option.tag}</span>
                                    )}
                                    <Icon name="book" size={14} />
                                  </button>
                                  <button
                                    type="button"
                                    className="dev-card-body"
                                    onClick={() => toggle(step, option.id)}
                                    aria-pressed={isSelected}
                                  >
                                    {option.summary && (
                                      <span className="dev-card-summary">{option.summary}</span>
                                    )}
                                    <span className="dev-card-mark">
                                      {isSelected ? (
                                        <>
                                          <Icon name="check" size={13} /> Выбрано
                                        </>
                                      ) : (
                                        "Выбрать"
                                      )}
                                    </span>
                                  </button>
                                </article>
                              );
                            })}
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

                  {level.granted.length > 0 && (
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

                  {level.upcoming.length > 0 && (
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

                  {level.status === "next" && level.steps.length > 0 && (
                    <div className="dev-advance">
                      <span className="dev-block-title">Способ повышения</span>
                      <div className="dev-advance-row">
                        {(["milestone", "xp"] as const).map((value) => (
                          <Chip
                            key={value}
                            active={mode === value}
                            tone="green"
                            onClick={() => setMode(value)}
                          >
                            {value === "milestone" ? "Решением ведущего" : "За опыт"}
                          </Chip>
                        ))}
                      </div>
                      {nextLevel && mode === "xp" && (
                        <p className="dev-note mono">
                          Опыт: {nextLevel.plan.xpRequired} · не хватает{" "}
                          {nextLevel.plan.xpMissing}
                        </p>
                      )}
                      <label className="dev-review">
                        <input
                          type="checkbox"
                          checked={reviewed}
                          onChange={(event) => setReviewed(event.target.checked)}
                        />
                        <span>Я прочитал(а) правила нового уровня</span>
                      </label>
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

      {dirty && (
        <p className="dev-footnote">
          Черновик хранится только на этой вкладке. Несохранённые выборы не меняют лист.
        </p>
      )}

      <Modal
        open={!!detail}
        onClose={() => setDetail(undefined)}
        title={detail ? detail.option.label : ""}
        wide={!!detail?.option.ability}
        footer={
          detail ? (
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
          ) : undefined
        }
      >
        {detail?.option.ability ? (
          <AbilityCard ability={detail.option.ability} character={character} />
        ) : (
          <div className="dev-detail">
            {detail?.option.tag && (
              <span className="dev-card-tag">{detail.option.tag}</span>
            )}
            {detail?.option.summary && <RichText text={detail.option.summary} />}
            {detail?.option.detail && detail.option.detail !== detail.option.summary && (
              <RichText text={detail.option.detail} />
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
