import { developmentIssue, developmentMessage } from "../../i18n/development-messages";
import { BUILDER_DATA } from "../../lib/character-builder";
import { classPreset } from "../../data/classes";
import { kitByName } from "../../data/kits";
import { SKILL_ORIGINALS } from "../../data/skills";
import { perkById } from "../../data/perks";
import { useLocale } from "../../i18n/locale";
import { useCallback, useEffect, useMemo, useState } from "react";
import "./DevelopmentPanel.css";
import { AbilityCard, AbilityCardContent } from "../../components/AbilityCard";
import { PerkCard } from "../../components/PerkCard";
import { Icon } from "../../components/Icons";
import { PerkDetailModal } from "../../components/PerkDetailModal";
import { Button, Chip } from "../../components/ui";
import { CardDetailModal } from "../../components/CardDetailModal";
import { kindLabel } from "../../data/actions";
import { kindTone } from "../abilities/shared";
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
import { ClassFeatureChoices, FeatureTriggerButton } from "./ClassFeaturesPanel";
import { PassiveFeatureCard } from "./PassiveFeatureCard";

interface DetailState {
  option: DevelopmentOption;
  step?: DevelopmentStep;
  source?: string;
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
  const { t, locale } = useLocale();
  const msg = (text: string) => {
    if (locale === "en") {
      const abilityHint = /^(.+): способность (\d+)-го уровня$/.exec(text);
      if (abilityHint) {
        const subclass = BUILDER_DATA.classes.flatMap(item => item.subclasses).find(item => item.name === abilityHint[1]);
        if (subclass?.originalName) return `${subclass.originalName}: level ${abilityHint[2]} ability`;
      }
    }
    return developmentMessage(text, locale);
  };
  const fixedValue = (label: string, value: string) => {
    if (locale !== "en") return value;
    if (label === "Класс") return classPreset(value)?.originalName || value;
    if (label === "Комплект") return kitByName(value)?.originalName || value;
    if (label === "Навыки создания") return SKILL_ORIGINALS[value]?.originalName || value;
    return value;
  };
  const perkTypes = { crafting: "Crafting", exploration: "Exploration", interpersonal: "Interpersonal", intrigue: "Intrigue", lore: "Lore", supernatural: "Supernatural" } as const;
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
        t(`В шаге «${step.title}» можно выбрать только ${step.count}. Снимите лишнее.`, `Choose at most ${step.count} in “${msg(step.title)}”. Remove extra choices.`),
      );
      return;
    }
    setDraft({ ...draft, [step.id]: [...selected, optionId] });
  };

  const reset = useCallback(() => {
    setDraft({});
    setBlocked(undefined);
    setNotice(t("Черновик сброшен — вкладка снова показывает сохранённое состояние героя.", "Draft reset; the saved hero is shown again."));
  }, [t]);

  const save = useCallback(() => {
    const result = applyDevelopment(character, plan, input);
    if (!result.ok) {
      setNotice(undefined);
      setBlocked(msg(result.issues[0]));
      return;
    }
    update(() => result.next);
    setDraft({});
    setBlocked(undefined);
    setClosed(defaultClosedLevels(buildDevelopmentPlan(result.next)));
    setNotice(
      result.leveledUp
        ? t(`Сохранено. Герой поднялся до ${result.next.level}-го уровня.`, `Saved. The hero reached level ${result.next.level}.`)
        : t("Сохранено.", "Saved."),
    );
  }, [character, plan, input, update, t]);

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

  const renderDetailAction = (step: DevelopmentStep, optionId: string) => (
    <Button
      className="dev-detail-action"
      variant="primary"
      onClick={() => {
        toggle(step, optionId);
        setDetail(undefined);
      }}
    >
      {stepSelection(step, draft).includes(optionId) ? t("Снять выбор", "Deselect") : t("Выбрать", "Select")}
    </Button>
  );

  const levels = [...plan.levels].reverse();

  return (
    <div className="dev-panel">
      <header className="dev-head">
        <h2 className="dev-title">{t("Развитие", "Advancement")}</h2>
        <div className="dev-head-actions">
          <Button
            size="sm"
            variant="ghost"
            onClick={reset}
            disabled={!dirty && !engaged}
          >
            {t("Сбросить", "Reset")}
          </Button>
          <Button size="sm" variant="primary" onClick={save} disabled={!canSave}>
            {engaged || (!dirty && plan.nextLevel) ? t("Повысить уровень", "Level up") : t("Сохранить", "Save")}
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
                  {developmentIssue(issue.message, issue.level, plan.levels.flatMap(level => level.steps).find(step => step.id === issue.stepId)?.title ?? "", locale)}
                </li>
              ))}
              {visibleIssues.length > 4 && (
                <li>{t(`…и ещё ${visibleIssues.length - 4}`, `…and ${visibleIssues.length - 4} more`)}</li>
              )}
            </ul>
          )}
          {dirty && visibleIssues.length === 0 && (
            <p className="dev-note">{t("Черновик готов — сохраните, чтобы применить.", "Draft ready — save to apply.")}</p>
          )}
        </div>
      )}

      <div className="dev-class-choices">
        <ClassFeatureChoices />
      </div>

      <div className="dev-levels">
        {levels.map((level) => {
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
                <span className="dev-level-title">{locale === "en" ? `Level ${level.level}` : level.title}</span>
                <span className="dev-level-echelon mono">{locale === "en" ? `Echelon ${level.echelonLabel.match(/\d+/)?.[0] ?? ""}` : level.echelonLabel}</span>
                <span className="dev-level-status">{locale === "en" ? ({ sealed: "Creation", applied: "Gained", next: "Next" } as const)[level.status] : STATUS_LABEL[level.status]}</span>
                {incomplete > 0 && (
                  <span className="dev-level-incomplete">
                    {locale === "en" ? `${incomplete} incomplete` : `${incomplete} не заполнено`}
                  </span>
                )}
              </button>

              {!isClosed && (
                <div className="dev-level-body">
                  {level.note && <p className="dev-note">{msg(level.note)}</p>}

                  {level.fixed.length > 0 && (
                    <div className="dev-fixed">
                      {level.fixed.map((row) => (
                        <div key={row.label} className="dev-fixed-row">
                          <span className="dev-fixed-label">{msg(row.label)}</span>
                          <span className="dev-fixed-values">{row.values.map(value => fixedValue(row.label, value)).join(" · ")}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {(level.granted.length > 0 || level.features.length > 0) && (
                    <section className="dev-rewards">
                      <h3 className="dev-rewards-title">
                        {level.status === "next" ? t("Получите автоматически", "Granted automatically") :
                          level.status === "sealed" ? t("Особенности при создании", "Creation features") : t("Получено автоматически", "Granted automatically")}
                      </h3>
                      <div className="sheet-ability-grid dev-cards">
                        {level.granted.map((ability) => (
                          <AbilityCard
                            key={ability.id}
                            ability={ability}
                            character={character}
                            onOpen={() => setDetail({
                              option: { id: ability.id, label: ability.name, ability },
                              source: level.status === "next" ? t("Получите автоматически", "Granted automatically") : t("Получено автоматически", "Granted automatically"),
                            })}
                          />
                        ))}
                        {level.features.map((feature) => (
                          <PassiveFeatureCard
                            key={feature.id}
                            item={feature}
                            action={level.status !== "next" && feature.trigger
                              ? <FeatureTriggerButton item={feature} />
                              : undefined}
                          />
                        ))}
                      </div>
                    </section>
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
                          <h3 className="dev-step-title">{msg(step.title)}</h3>
                          {step.hint && <span className="dev-step-hint">{msg(step.hint)}</span>}
                          <span className="dev-step-count mono">
                            {stepProgress(step, selected)}
                          </span>
                        </div>
                        {step.kind === "ability" ? (
                          <div className="sheet-ability-grid dev-cards">
                            {step.options.map((option) => {
                              const isSelected = selected.includes(option.id);
                              if (!option.ability) return null;
                              return (
                                <AbilityCard
                                  key={option.id}
                                  ability={option.ability}
                                  canonical
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
                                        {locale === "en" && key !== "other" ? perkTypes[key] : meta?.label ?? t("Другие", "Other")}
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
                                      <div className="perk-card-grid dev-perk-group-grid">
                                        {options.map((option) => {
                                          const isSelected = selected.includes(
                                            option.id,
                                          );
                                          return (
                                            <PerkCard
                                              key={option.id}
                                              name={option.label}
                                              ruleId={perkById(option.id)?.id}
                                              originalName={perkById(option.id)?.originalName}
                                              originalDescription={perkById(option.id)?.originalDescription}
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
                                  title={msg(option.summary ?? option.tag ?? "")}
                                  onClick={() => toggle(step, option.id)}
                                >
                                  {locale === "en" && step.kind === "skill" ? SKILL_ORIGINALS[option.label]?.originalName || option.label : locale === "en" && step.kind === "characteristic" ? ({ might: "Might", agility: "Agility", reason: "Reason", intuition: "Intuition", presence: "Presence" } as Record<string, string>)[option.id] ?? option.label : option.label}
                                </Chip>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>

      {detail?.option.ability ? (
        <CardDetailModal
          open
          onClose={() => setDetail(undefined)}
          title={locale === "en" ? detail.option.ability.originalName || detail.option.label : detail.option.label}
          source={msg(detail.step?.hint ?? detail.source ?? "")}
          meta={<Chip tone={kindTone(detail.option.ability.kind)}>{locale === "en" ? ({ signature: "Signature", heroic: "Heroic", "free-strike": "Free strike", other: "Other" } as const)[detail.option.ability.kind] : kindLabel(detail.option.ability.kind)}</Chip>}
          autoHeight
          footer={detail.step && renderDetailAction(detail.step, detail.option.id)}
        >
          <AbilityCardContent ability={detail.option.ability} character={character} />
        </CardDetailModal>
      ) : detail?.step ? (
        <PerkDetailModal
          open
          onClose={() => setDetail(undefined)}
          name={detail.option.label}
          perkId={detail.option.id}
          type={detail.option.perkType}
          eyebrow={msg(detail.step.hint ?? "")}
          summary={detail.option.summary}
          description={detail.option.detail}
          action={renderDetailAction(detail.step, detail.option.id)}
        />
      ) : null}
    </div>
  );
}
