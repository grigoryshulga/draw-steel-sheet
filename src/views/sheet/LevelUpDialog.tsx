import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { RichText } from "../../components/RichText";
import { Button, Field, Modal, Select, TextArea } from "../../components/ui";
import { ABILITY_COMPENDIUM } from "../../data/compendium";
import { LEVEL_UP_RULES } from "../../data/level-up-rules";
import { ALL_CREATION_SKILLS } from "../../data/creation-rules";
import { PERK_COMPENDIUM } from "../../data/perks";
import { CHARACTERISTICS } from "../../lib/rules";
import { getLevelUpPlan, previewLevelUp } from "../../lib/level-up";
import { useApp } from "../../state/AppContext";
import type { Character, LevelAdvancementRecord } from "../../types";
import "./LevelUpDialog.css";

type LevelUpMode = "xp" | "milestone";

interface ExpectedCharacter {
  characterId: string;
  fromLevel: number;
  className: string;
  subclass: string;
}

interface LevelUpSession extends ExpectedCharacter {
  mode: LevelUpMode;
  choices: Record<string, string[]>;
  notes: string;
  reviewedRules: boolean;
  manualMaxima: { stamina: number; recoveries: number };
}

interface Receipt {
  expected: ExpectedCharacter;
  record: LevelAdvancementRecord;
}

const KIND_LABELS: Record<string, string> = {
  ability: "Способности",
  perk: "Перк",
  skill: "Навык",
  characteristic: "Характеристика",
};

function expectedCharacter(character: Character): ExpectedCharacter {
  return {
    characterId: character.id,
    fromLevel: character.level,
    className: character.className,
    subclass: character.subclass,
  };
}

function matchesExpected(character: Character, expected: ExpectedCharacter) {
  return character.id === expected.characterId &&
    character.level === expected.fromLevel &&
    character.className === expected.className &&
    character.subclass === expected.subclass;
}

function sameIdentity(character: Character, expected: ExpectedCharacter) {
  return character.id === expected.characterId &&
    character.level === expected.fromLevel &&
    character.className === expected.className &&
    character.subclass === expected.subclass;
}

function choiceTitle(kind: string, label: string) {
  return `${KIND_LABELS[kind] ?? "Выбор"}: ${label}`;
}

function choiceGroupTitle(key: string, rule?: (typeof LEVEL_UP_RULES)[number]) {
  if (key === "perk") return "Перк";
  if (key === "skill") return "Навык";
  if (key === "characteristic") return "Характеристика";
  return rule?.abilityChoices.find((group) => group.id === key)?.label ?? "Другой выбор";
}

function choiceValueLabel(key: string, id: string) {
  if (key === "perk") {
    return PERK_COMPENDIUM.find((perk) => perk.id === id)?.name ?? "Перк (название недоступно)";
  }
  if (key === "skill") {
    return ALL_CREATION_SKILLS.includes(id) ? id : "Навык (название недоступно)";
  }
  if (key === "characteristic") {
    return CHARACTERISTICS.find((item) => item.key === id || item.label === id)?.label ?? "Характеристика (название недоступно)";
  }
  return ABILITY_COMPENDIUM.find((ability) => ability.id === id)?.name ?? "Способность (название недоступно)";
}

function RuleFeatures({ rule }: { rule: (typeof LEVEL_UP_RULES)[number] }) {
  return (
    <details className="level-up-rule-details">
      <summary>Правила и особенности уровня</summary>
      <div className="level-up-rule-content">
        {rule.features.map((feature) => (
          <article className="level-up-feature" key={feature.id}>
            <h4>{feature.name}</h4>
            <div className="level-up-markdown"><ReactMarkdown remarkPlugins={[remarkGfm]}>{feature.description}</ReactMarkdown></div>
          </article>
        ))}
        <a className="level-up-article-link" href={`#/codex/${rule.articleId}`}>
          Читать главу «{rule.title}»
        </a>
      </div>
    </details>
  );
}

/** Advancement history is derived from saved records, so it remains after reload. */
export function LevelUpHistory({ character }: { character: Character }) {
  const records = [...(character.advancements ?? [])].reverse();
  if (records.length === 0) return null;
  return (
    <section className="level-up-history" aria-label="История повышений уровня">
      <h3>Повышения уровня</h3>
      {records.map((record, index) => {
        const rule = LEVEL_UP_RULES.find((item) =>
          item.className === record.className && item.level === record.toLevel && item.articleId === record.articleId,
        );
        return (
          <details className="level-up-history-item" key={`${record.toLevel}:${record.createdAt}:${index}`}>
            <summary>Уровень {record.toLevel} · {record.className}</summary>
            <p>{record.mode === "xp" ? "За опыт" : "Решение ведущего"}</p>
            {Object.entries(record.choices).length ? (
              <ul className="level-up-receipt-choices">
                {Object.entries(record.choices).map(([key, values]) => (
                  <li key={key}>
                    <strong>{choiceGroupTitle(key, rule)}:</strong>{" "}
                    {values.map((value) => choiceValueLabel(key, value)).join(", ")}
                  </li>
                ))}
              </ul>
            ) : <p>Дополнительных выборов не было.</p>}
            <p><strong>Заметка:</strong> {record.notes || "не добавлена"}</p>
            {rule && <RuleFeatures rule={rule} />}
            <a className="level-up-article-link" href={`#/codex/${record.articleId}`}>
              Читать главу «{rule?.title ?? `уровень ${record.toLevel}`}»
            </a>
          </details>
        );
      })}
    </section>
  );
}

/** Диалог следующего уровня и сохранённая квитанция о полученных правилах. */
export function LevelUpDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { character, update, notify } = useApp();
  const [session, setSession] = useState<LevelUpSession | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [issue, setIssue] = useState("");
  const [saving, setSaving] = useState(false);
  const submitting = useRef(false);

  useEffect(() => {
    if (session && !matchesExpected(character, session)) {
      setSession(null);
      setIssue("");
      submitting.current = false;
      setSaving(false);
      onClose();
    }
    if (receipt && !sameIdentity(character, receipt.expected)) {
      setReceipt(null);
    }
  }, [character, onClose, receipt, session]);

  const currentPlan = getLevelUpPlan(character);
  const activeSession = open && session && matchesExpected(character, session)
    ? session
    : null;
  const targetLevel = activeSession ? activeSession.fromLevel + 1 : character.level;
  const sourceRule = activeSession
    ? currentPlan.rule
    : receipt
      ? LEVEL_UP_RULES.find((rule) =>
          rule.className === receipt.record.className &&
          rule.level === receipt.record.toLevel &&
          rule.articleId === receipt.record.articleId,
        )
      : undefined;

  const selectedLabels = useMemo(() => {
    if (!activeSession) return [];
    return currentPlan.choices.flatMap((choice) =>
      (activeSession.choices[choice.id] ?? []).map((id) => ({
        key: `${choice.id}:${id}`,
        title: choiceTitle(choice.kind, choice.label),
        label: choice.options.find((option) => option.id === id)?.label ?? id,
        description: choice.options.find((option) => option.id === id)?.description,
      })),
    );
  }, [activeSession, currentPlan.choices]);

  const openLevelUp = () => {
    const plan = getLevelUpPlan(character);
    if (!plan.available) {
      notify(plan.reason ?? "Повышение сейчас недоступно", "info");
      return;
    }
    submitting.current = false;
    setSaving(false);
    setIssue("");
    setReceipt(null);
    setSession({
      ...expectedCharacter(character),
      mode: "xp",
      choices: {},
      notes: "",
      reviewedRules: false,
      manualMaxima: {
        stamina: character.stamina.max,
        recoveries: character.recoveries.max,
      },
    });
  };

  useEffect(() => {
    if (open && !session) openLevelUp();
  }, [open, session]);

  const updateChoice = (choiceId: string, index: number, value: string) => {
    setSession((previous) => {
      if (!previous) return previous;
      const values = [...(previous.choices[choiceId] ?? [])];
      values[index] = value;
      const compact = values.filter(Boolean);
      return {
        ...previous,
        choices: { ...previous.choices, [choiceId]: compact },
      };
    });
    setIssue("");
  };

  const request = activeSession
    ? {
        characterId: activeSession.characterId,
        fromLevel: activeSession.fromLevel,
        className: activeSession.className,
        subclass: activeSession.subclass,
        mode: activeSession.mode,
        choices: activeSession.choices,
        reviewedRules: true,
        notes: activeSession.notes,
        ...(character.automation?.enabled
          ? {}
          : { manualMaxima: activeSession.manualMaxima }),
      }
    : null;
  const preview = activeSession && request
    ? previewLevelUp(character, request)
    : null;
  const selectionReady = Boolean(preview?.ok);
  const insufficientXp = activeSession?.mode === "xp" && currentPlan.xpMissing > 0;

  const close = () => {
    if (saving) return;
    submitting.current = false;
    setSession(null);
    setIssue("");
    onClose();
  };

  const confirm = () => {
    if (!activeSession || !request || submitting.current) return;
    submitting.current = true;
    setSaving(true);
    setIssue("");
    let appliedRecord: LevelAdvancementRecord | null = null;
    let applied = false;
    try {
      update((current) => {
        if (!matchesExpected(current, activeSession)) {
          setIssue("Лист изменился. Закройте это окно и откройте повышение заново.");
          return current;
        }
        const result = previewLevelUp(current, {
          ...request,
          reviewedRules: activeSession.reviewedRules,
        });
        if (!result.ok) {
          setIssue(result.issues.join(" ") || "Проверьте выборы и попробуйте ещё раз.");
          return current;
        }
        const record = result.rawNext.advancements?.find(
          (entry) => entry.fromLevel === activeSession.fromLevel &&
            entry.toLevel === activeSession.fromLevel + 1 &&
            entry.className === activeSession.className &&
            entry.subclass === activeSession.subclass,
        );
        if (!record) {
          setIssue("Не удалось сохранить запись о повышении. Изменения не применены.");
          return current;
        }
        appliedRecord = record;
        applied = true;
        return result.rawNext;
      });
    } catch {
      setIssue("Не удалось сохранить повышение. Попробуйте ещё раз.");
    }
    if (applied && appliedRecord) {
      const nextExpected = {
        characterId: activeSession.characterId,
        fromLevel: activeSession.fromLevel + 1,
        className: activeSession.className,
        subclass: activeSession.subclass,
      };
      setReceipt({ expected: nextExpected, record: appliedRecord });
      setSession(null);
      submitting.current = false;
      setSaving(false);
      onClose();
      notify(`Уровень повышен до ${activeSession.fromLevel + 1}`, "success");
    } else {
      submitting.current = false;
      setSaving(false);
    }
  };

  if (receipt && sameIdentity(character, receipt.expected)) {
    const rule = sourceRule;
    return (
      <Modal
        open
        onClose={() => setReceipt(null)}
        title={`Уровень ${receipt.record.toLevel} получен`}
        className="level-up-dialog level-up-receipt"
        wide
        footer={<Button variant="primary" onClick={() => setReceipt(null)}>Готово</Button>}
      >
        <p className="level-up-lead">
          {receipt.record.mode === "xp"
            ? "Повышение подтверждено за опыт. Опыт сохранён на листе."
            : "Повышение подтверждено решением ведущего."}
        </p>
        <section className="level-up-section">
          <h3>Ваш выбор</h3>
          {Object.entries(receipt.record.choices).length ? (
            <ul className="level-up-receipt-choices">
              {Object.entries(receipt.record.choices).map(([key, values]) => (
                <li key={key}>
                  <strong>{choiceGroupTitle(key, rule)}:</strong>{" "}
                  {values.map((value) => choiceValueLabel(key, value)).join(", ")}
                </li>
              ))}
            </ul>
          ) : <p>Дополнительных выборов не было.</p>}
          <p><strong>Заметка:</strong> {receipt.record.notes || "не добавлена"}</p>
        </section>
        {rule && (
          <section className="level-up-section">
            <h3>Текст правил</h3>
            <RuleFeatures rule={rule} />
          </section>
        )}
        <p className="level-up-note">
          В истории сохранены выбранные варианты, заметка и ссылка на главу. Описание открывает актуальный текст;
          эффекты особенностей применяются за игровым столом, если они не указаны как проверяемое изменение листа.
        </p>
      </Modal>
    );
  }

  if (!activeSession || !currentPlan.rule) return null;

  const rule = currentPlan.rule;
  const previewCharacter = preview?.ok ? preview.next : null;
  const automaticGrants = currentPlan.grantedAbilityIds.map((id, index) => ({
    key: `${id}:${index}`,
    name: ABILITY_COMPENDIUM.find((ability) => ability.id === id)?.name ?? "Название способности недоступно",
  }));
  const generalFeaturesWarning = "Тексты новых особенностей доступны в правилах; автоматически применяются только характеристики, навыки, перки и способности.";
  const actionableWarnings = currentPlan.warnings.filter((warning) => warning !== generalFeaturesWarning);
  const targetCharacteristics = rule.characteristics;
  const hasAutoNumericGrowth = Boolean(
    character.automation?.enabled &&
    (targetCharacteristics?.set || targetCharacteristics?.increaseAll),
  );

  return (
    <Modal
      open
      onClose={close}
      title={`Повышение: ${activeSession.fromLevel} → ${targetLevel}`}
      className="level-up-dialog"
      wide
      footer={(
        <div className="level-up-footer">
          <span className="level-up-footer-hint">
            {issue || (insufficientXp ? "Для режима опыта пока не хватает опыта." : "Отмена не меняет лист героя.")}
          </span>
          <div className="level-up-footer-actions">
            <Button variant="ghost" onClick={close} disabled={saving}>Отмена</Button>
            <Button
              variant="primary"
              onClick={confirm}
              disabled={saving || !selectionReady || insufficientXp || !activeSession.reviewedRules}
            >
              {saving ? "Сохраняем…" : "Подтвердить повышение"}
            </Button>
          </div>
        </div>
      )}
    >
      <p className="level-up-lead">
        {rule.title}. Особенности и выборы ниже относятся к {activeSession.className} на {targetLevel}-м уровне.
      </p>

      <section className="level-up-section">
        <h3>Как подтверждаем повышение</h3>
        <fieldset className="level-up-mode">
          <legend>Способ повышения</legend>
          <label>
            <input
              type="radio"
              name="level-up-mode"
              value="xp"
              checked={activeSession.mode === "xp"}
              onChange={() => setSession((value) => value ? { ...value, mode: "xp" } : value)}
            />
            За опыт
          </label>
          <label>
            <input
              type="radio"
              name="level-up-mode"
              value="milestone"
              checked={activeSession.mode === "milestone"}
              onChange={() => setSession((value) => value ? { ...value, mode: "milestone" } : value)}
            />
            Решение ведущего
          </label>
        </fieldset>
        <div className={`level-up-xp ${insufficientXp ? "is-short" : ""}`} aria-live="polite">
          <span>Порог для {targetLevel}-го уровня: <strong>{currentPlan.xpRequired} XP</strong></span>
          <span>Сейчас: <strong>{character.xp} XP</strong></span>
          {insufficientXp && <span>Не хватает {currentPlan.xpMissing} XP. Можно выбрать решение ведущего.</span>}
          <small>Опыт не тратится и не сбрасывается.</small>
        </div>
      </section>

      {currentPlan.classFeatures.length > 0 && (
        <section className="level-up-section">
          <h3>Что вы получите</h3>
          <ul className="level-up-gifts">
            {currentPlan.classFeatures.map((feature) => (
              <li className="level-up-gift" key={feature.id}>
                <strong className="level-up-gift-name">{feature.name}</strong>
                {feature.summary && (
                  <span className="level-up-gift-summary">
                    {feature.summary}
                  </span>
                )}
              </li>
            ))}
          </ul>
          <p className="level-up-gift-note">
            Эти особенности приходят вместе с уровнем — выбирать их не нужно.
          </p>
        </section>
      )}

      {currentPlan.choices.length > 0 && (
        <section className="level-up-section">
          <h3>Выборы</h3>
          {currentPlan.choices.map((choice) => (
            <fieldset className="level-up-choice" key={choice.id}>
              <legend>{choice.label} <span>— выберите {choice.count}</span></legend>
              {Array.from({ length: choice.count }, (_, index) => {
                const selected = activeSession.choices[choice.id]?.[index] ?? "";
                const used = new Set(activeSession.choices[choice.id] ?? []);
                return (
                  <Field key={`${choice.id}:${index}`} label={`${choice.label}, выбор ${index + 1}`}>
                    <Select
                      value={selected}
                      onChange={(event) => updateChoice(choice.id, index, event.target.value)}
                      aria-label={`${choice.label}, выбор ${index + 1}`}
                    >
                      <option value="">Выберите вариант…</option>
                      {choice.options.map((option) => (
                        <option
                          key={option.id}
                          value={option.id}
                          disabled={used.has(option.id) && option.id !== selected}
                        >
                          {option.label}
                        </option>
                      ))}
                    </Select>
                    {selected && choice.options.find((option) => option.id === selected)?.description && (
                      <RichText
                        className="level-up-option-description"
                        text={choice.options.find((option) => option.id === selected)?.description ?? ""}
                      />
                    )}
                  </Field>
                );
              })}
              <small>{KIND_LABELS[choice.kind] ?? "Награда"}</small>
            </fieldset>
          ))}
        </section>
      )}

      {preview && !preview.ok && !insufficientXp && preview.issues.length > 0 && (
        <p className="level-up-validation" role="status">
          {preview.issues.join(" ")}
        </p>
      )}

      <section className="level-up-section">
        <h3>Что изменится на листе</h3>
        {character.automation?.enabled ? (
          <>
            <p>Проверяемые изменения пересчитаются с учётом сохранённых особенностей и поправок.</p>
            {hasAutoNumericGrowth && (
              <p>Текущая выносливость и восстановления не увеличатся; повышение максимума не лечит героя.</p>
            )}
          </>
        ) : (
          <>
            <p>Автоматический пересчёт выключен. Укажите максимумы вручную; по умолчанию оставлены прежние значения.</p>
            <div className="level-up-maxima">
              <Field label="Максимум выносливости">
                <input
                  className="input"
                  type="number"
                  min="0"
                  value={activeSession.manualMaxima.stamina}
                  onChange={(event) => setSession((value) => value ? {
                    ...value,
                    manualMaxima: { ...value.manualMaxima, stamina: Math.max(0, Number(event.target.value) || 0) },
                  } : value)}
                />
              </Field>
              <Field label="Максимум восстановлений">
                <input
                  className="input"
                  type="number"
                  min="0"
                  value={activeSession.manualMaxima.recoveries}
                  onChange={(event) => setSession((value) => value ? {
                    ...value,
                    manualMaxima: { ...value.manualMaxima, recoveries: Math.max(0, Number(event.target.value) || 0) },
                  } : value)}
                />
              </Field>
            </div>
          </>
        )}
        {previewCharacter ? (
          <div className="level-up-preview" aria-live="polite">
            <div><span>Выносливость</span><strong>{character.stamina.max} → {previewCharacter.stamina.max}</strong><small>Сейчас {character.stamina.current} → {previewCharacter.stamina.current}</small></div>
            <div><span>Восстановления</span><strong>{character.recoveries.max} → {previewCharacter.recoveries.max}</strong><small>Сейчас {character.recoveries.current} → {previewCharacter.recoveries.current}</small></div>
            {CHARACTERISTICS.map((item) => (
              <div key={item.key}><span>{item.label}</span><strong>{character.characteristics[item.key]} → {previewCharacter.characteristics[item.key]}</strong></div>
            ))}
          </div>
        ) : (
          <p className="level-up-preview-placeholder">
            {currentPlan.choices.length ? "Заполните обязательные выборы, чтобы увидеть числа." : "Числовое изменение появится после проверки правил."}
          </p>
        )}
      </section>

      <section className="level-up-section">
        <h3>Добавятся автоматически</h3>
        {automaticGrants.length > 0 ? (
          <ul className="level-up-receipt-choices">
            {automaticGrants.map((grant) => <li key={grant.key}>{grant.name}</li>)}
          </ul>
        ) : <p>Автоматических способностей на этом уровне нет.</p>}
      </section>

      {actionableWarnings.length > 0 && (
        <section className="level-up-section" role="status" aria-live="polite">
          <h3>Обратите внимание</h3>
          <ul className="level-up-receipt-choices">
            {actionableWarnings.map((warning, index) => <li key={`${warning}:${index}`}>{warning}</li>)}
          </ul>
        </section>
      )}

      <section className="level-up-section">
        <h3>Правила уровня</h3>
        <RuleFeatures rule={rule} />
        <p className="level-up-note">
          Лист применяет проверяемые изменения. Реактивные эффекты, перемещение, иммунитеты и другие правила
          применяются за игровым столом.
        </p>
      </section>

      {selectedLabels.length > 0 && (
        <section className="level-up-section">
          <h3>Выбрано</h3>
          <ul className="level-up-selected-list">
            {selectedLabels.map((item) => (
              <li key={item.key}><strong>{item.title}:</strong> {item.label}{item.description ? <p>{item.description}</p> : null}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="level-up-section">
        <Field label="Заметка к этому повышению">
          <TextArea
            rows={3}
            maxLength={1200}
            value={activeSession.notes}
            onChange={(event) => setSession((value) => value ? { ...value, notes: event.target.value } : value)}
            placeholder="Например, решение ведущего или договорённость за столом"
          />
        </Field>
        <label className="level-up-reviewed">
          <input
            type="checkbox"
            checked={activeSession.reviewedRules}
            onChange={(event) => setSession((value) => value ? { ...value, reviewedRules: event.target.checked } : value)}
          />
          Я прочитал(а) правила и проверил(а) выбранные варианты
        </label>
      </section>
    </Modal>
  );
}
