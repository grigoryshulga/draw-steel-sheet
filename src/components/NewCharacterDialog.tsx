import { useEffect, useMemo, useRef, useState } from "react";
import {
  BUILDER_DATA as data,
  buildCharacter,
  builderSkillSlots,
  emptyBuilderDraft,
  selectedSkills,
  grantedClassAbilities,
  selectableClassAbilities,
  startingCharacteristics,
  builderStepIssues,
  type BuilderDraft,
} from "../lib/character-builder";
import {
  BUILDER_STEPS,
  BUILDER_STEP_V2_KEY,
  LEGACY_BUILDER_STEP_V1_KEY,
  builderStepIndex,
  nextBuilderStep,
  previousBuilderStep,
  restoreBuilderStep,
  type BuilderStepId,
} from "../lib/builder-steps";
import { CLASS_PRESETS, classPreset } from "../data/classes";
import { classFeatureGroups } from "../data/class-feature-rules";
import { classFeatureOptionAutomated } from "../lib/class-feature-view";
import { featureEquipmentRequirements } from "../lib/feature-equipment-requirements";
import { KIT_COMPENDIUM, kitBonusLabel } from "../data/kits";
import { careerPerkType, PERK_COMPENDIUM, perkById } from "../data/perks";
import { CLASS_SIGNATURE_COUNTS, canUseKit } from "../data/creation-rules";
import { createCharacter } from "../lib/defaults";
import { CHARACTERISTICS, deriveStats } from "../lib/rules";
import type { Character, CompendiumAbility } from "../types";
import { useStorageScope } from "../state/StorageScope";
import { Button, Chip, Field, Modal, Select, TextArea, TextInput } from "./ui";
import { FeatureEquipmentFields } from "./FeatureEquipmentFields";
import { RuleText } from "./RuleText";
import { Artwork } from "./Artwork";
import { CharacteristicAllocator } from "./CharacteristicAllocator";
import { AbilityCard } from "./AbilityCard";
import { SkillPicker } from "./SkillPicker";
import { artFor } from "../lib/art";
import "../views/CodexView.css";
import "./NewCharacterDialog.css";

const DRAFT_KEY = "ds-builder-draft-v1";
function scopedStorageKey(key: string, scope: string): string {
  return scope === "local" ? key : `${key}:${scope}`;
}
const STEPS = BUILDER_STEPS;
function readDraft(key: string): BuilderDraft {
  try {
    const stored = JSON.parse(localStorage.getItem(key) || "null");
    if (
      stored?.version === 1 &&
      Array.isArray(stored.traits) &&
      Array.isArray(stored.abilityIds)
    ) {
      const base = emptyBuilderDraft();
      return {
        ...base,
        ...stored,
        ancestrySkills: Array.isArray(stored.ancestrySkills)
          ? stored.ancestrySkills.filter((value: unknown): value is string => typeof value === "string")
          : base.ancestrySkills,
        culture: { ...base.culture, ...stored.culture },
        characteristics: { ...base.characteristics, ...stored.characteristics },
      };
    }
  } catch {
    /* Start fresh if storage is unavailable or malformed. */
  }
  return emptyBuilderDraft();
}
function Reference({
  id,
  text,
  label = "Текст из книги",
}: {
  id?: string;
  text: string;
  label?: string;
}) {
  return (
    <details className="builder-reference">
      <summary>{label}</summary>
      <RuleText text={text} />
      {id && (
        <a href={`#/codex/${id}`} target="_blank" rel="noreferrer">
          Открыть в Кодексе ↗
        </a>
      )}
    </details>
  );
}
export function NewCharacterDialog({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (character: Character) => Promise<void> | void;
}) {
  const scope = useStorageScope();
  const draftKey = scopedStorageKey(DRAFT_KEY, scope);
  const stepKey = scopedStorageKey(BUILDER_STEP_V2_KEY, scope);
  const legacyStepKey = scopedStorageKey(LEGACY_BUILDER_STEP_V1_KEY, scope);
  const [draft, setDraft] = useState(() => readDraft(draftKey));
  const [step, setStep] = useState<BuilderStepId>(() => {
    try {
      return restoreBuilderStep(localStorage.getItem(stepKey), localStorage.getItem(legacyStepKey), {
        ancestry: Boolean(draft.ancestry),
        career: Boolean(draft.career),
        className: Boolean(draft.className),
      });
    } catch {
      return "concept";
    }
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showIssues, setShowIssues] = useState(false);
  const seed = useRef(createCharacter());
  const stepsRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const hero = useMemo(() => buildCharacter(draft, seed.current), [draft]);
  const derived = deriveStats(hero);
  const patch = (changes: Partial<BuilderDraft>) => {
    setDraft((current) => ({ ...current, ...changes }));
    setError("");
  };
  const ancestry = data.ancestries.find((a) => a.name === draft.ancestry);
  const career = data.careers.find((c) => c.name === draft.career);
  const classData = data.classes.find((c) => c.name === draft.className);
  const preset = classPreset(draft.className);
  const skillSlots = builderSkillSlots(draft);
  const ancestrySkills = selectedSkills(skillSlots.ancestry, draft.ancestrySkills || []);
  const cultureSkills = selectedSkills(skillSlots.culture, draft.cultureSkills, ancestrySkills);
  const careerSkills = selectedSkills(skillSlots.career, draft.careerSkills, [...ancestrySkills, ...cultureSkills]);
  const traitsSpent =
    ancestry?.traits
      .filter((t) => draft.traits.includes(t.name))
      .reduce((sum, t) => sum + t.cost, 0) ?? 0;
  const grantedAbilities = grantedClassAbilities(draft);
  const classAbilities = selectableClassAbilities(draft);
  const signatureCount = CLASS_SIGNATURE_COUNTS[draft.className] ?? 0;
  useEffect(() => {
    try {
      localStorage.setItem(draftKey, JSON.stringify(draft));
    } catch {
      /* in-memory draft remains available */
    }
  }, [draft, draftKey]);
  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0 });
    try {
      localStorage.setItem(stepKey, step);
    } catch {
      /* no storage */
    }
  }, [step, stepKey]);
  useEffect(() => {
    const nav = stepsRef.current;
    if (!open || !nav) return;

    const revealCurrentStep = () => {
      const current = nav.querySelector<HTMLElement>('[aria-current="step"]');
      if (!current) return;

      const navRect = nav.getBoundingClientRect();
      const currentRect = current.getBoundingClientRect();
      let left = nav.scrollLeft;
      if (currentRect.left < navRect.left) {
        left += currentRect.left - navRect.left;
      } else if (currentRect.right > navRect.right) {
        left += currentRect.right - navRect.right;
      } else {
        return;
      }
      nav.scrollTo({ left, behavior: "auto" });
    };

    revealCurrentStep();
    const observer = new ResizeObserver(revealCurrentStep);
    observer.observe(nav);
    return () => observer.disconnect();
  }, [open, step]);
  const issues = builderStepIssues(draft);
  const go = (next: BuilderStepId) => {
    setStep(next);
    setError("");
    setShowIssues(false);
  };
  const submit = async (blank = false) => {
    const invalid = BUILDER_STEPS.find(({ id }) => Boolean(issues[id]));
    if (!blank && invalid) {
      go(invalid.id);
      setShowIssues(true);
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onCreate(blank ? createCharacter({ name: draft.name }) : hero);
      setDraft(emptyBuilderDraft());
      setStep("concept");
      seed.current = createCharacter();
      try {
        localStorage.removeItem(draftKey);
      } catch {
        /* no storage */
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось создать героя");
    } finally {
      setBusy(false);
    }
  };
  const abilityGroups: {
    label: string;
    entries: CompendiumAbility[];
    count: number | null;
  }[] = [
    {
      label: "Знаковые",
      entries: classAbilities.filter((a) => a.kind === "signature"),
      count: signatureCount,
    },
    {
      label: "За 3 ресурса",
      entries: classAbilities.filter((a) => a.resourceCost === 3),
      count: 1,
    },
    {
      label: "За 5 ресурса",
      entries: classAbilities.filter((a) => a.resourceCost === 5),
      count: 1,
    },
    {
      label: "Другие и триггеры",
      entries: classAbilities.filter(
        (a) => a.kind !== "signature" && ![3, 5].includes(a.resourceCost),
      ),
      count: null,
    },
  ];
  return (
    <Modal
      open={open}
      onClose={busy ? () => undefined : onClose}
      wide
      className="character-builder"
      title="Создание героя"
      footer={
        <>
          <span className="builder-draft-label muted small">
            Черновик сохраняется в этом браузере
          </span>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Продолжить позже
          </Button>
          {step !== "concept" && (
            <Button onClick={() => go(previousBuilderStep(step))} disabled={busy}>
              Назад
            </Button>
          )}
          <Button
            variant="primary"
            disabled={busy}
            onClick={() =>
              step === "summary"
                ? void submit()
                : issues[step]
                  ? setShowIssues(true)
                  : go(nextBuilderStep(step))
            }
          >
            {busy ? "Создание…" : step === "summary" ? "Создать героя" : "Далее →"}
          </Button>
        </>
      }
    >
      <div className="builder-layout">
        <nav ref={stepsRef} className="builder-steps" aria-label="Этапы создания героя">
          {STEPS.map(({ id, label }, i) => (
            <button
              key={id}
              type="button"
              aria-current={step === id ? "step" : undefined}
              className={step === id ? "is-active" : ""}
              onClick={() => go(id)}
            >
              <span>
                {!issues[id] && id !== "summary" ? "✓" : String(i + 1).padStart(2, "0")}
              </span>
              {label}
            </button>
          ))}
        </nav>
        <div className="builder-content" ref={contentRef}>
          <span className="eyebrow">
            Шаг {builderStepIndex(step) + 1} из {STEPS.length} · Герой 1-го уровня
          </span>
          <h2 className="builder-step-title">{STEPS[builderStepIndex(step)].label}</h2>
          <details className="builder-mobile-preview">
            <summary>
              Лист: {hero.name} · {hero.stamina.max} выносливости
            </summary>
            <div className="builder-preview-stats">
              {CHARACTERISTICS.map((c) => (
                <div key={c.key}>
                  <span>{c.short}</span>
                  <strong>{hero.characteristics[c.key]}</strong>
                </div>
              ))}
            </div>
            <p>
              Скорость {hero.speed} · Устойчивость {hero.stability} ·
              Восстановления {hero.recoveries.max} × {derived.recoveryValue}
            </p>
            <p>Навыки: {hero.skills.join(", ") || "ещё не выбраны"}</p>
            <p>Способности: {hero.abilities.map((a) => a.name).join(", ")}</p>
          </details>
          {step === "concept" && (
            <>
              <p className="builder-intro">
                Начните с идеи. Каждый выбор добавит новую часть в лист справа.
              </p>
              <Field label="Имя героя">
                <TextInput
                  autoFocus
                  placeholder="Как зовут вашего героя?"
                  value={draft.name}
                  onChange={(e) => patch({ name: e.target.value })}
                />
              </Field>
              <Field label="Кем вы хотите быть?">
                <TextArea
                  placeholder="Как вы сражаетесь? Что умеете вне боя? Почему стали героем?"
                  rows={5}
                  value={draft.concept}
                  onChange={(e) => patch({ concept: e.target.value })}
                />
              </Field>
              <Reference
                id="0301"
                label="О создании героя"
                text="Порядок шагов — предложение из книги. Можно переходить между этапами и возвращаться к прежним решениям. Свободные удары и базовые действия добавляются автоматически."
              />
              <Button
                variant="ghost"
                onClick={() => void submit(true)}
                disabled={busy}
              >
                Создать пустой лист для ручного заполнения
              </Button>
            </>
          )}
          {step === "ancestry" && (
            <>
              <p className="builder-intro">
                Выберите происхождение, чтобы раскрыть его полный текст прямо в карточке.
              </p>
              <div className="builder-option-grid">
                {data.ancestries.map((a, index) => {
                  const selected = a.name === draft.ancestry;
                  const detailsId = `builder-ancestry-option-${index}-details`;
                  return (
                  <div className={`builder-option-card ${selected ? "is-expanded" : ""}`} key={a.name}>
                  <button
                    type="button"
                    className={`builder-option ${artFor("ancestry", a.name) ? "with-art" : ""} ${selected ? "is-selected" : ""}`}
                    aria-pressed={selected}
                    aria-expanded={selected}
                    aria-controls={detailsId}
                    onClick={() => {
                      if (a.name !== draft.ancestry) patch({ ancestry: a.name, traits: [], ancestrySkills: [] });
                    }}
                  >
                    <Artwork kind="ancestry" name={a.name} />
                    <strong>{a.name}</strong>
                    <span className="builder-option__snippet">{a.summary.slice(0, 155)}{a.summary.length > 155 ? "…" : ""}</span>
                  </button>
                  <section className="builder-option-details" id={detailsId} aria-label={`Описание происхождения: ${a.name}`} aria-hidden={!selected} inert={!selected}>
                    <div className="builder-option-details__content"><RuleText text={a.summary} /></div>
                  </section>
                  </div>
                )})}
              </div>
            </>
          )}
          {step === "ancestry-options" && (
            <>
              {ancestry ? (
                <>
                  <div className="builder-selection-summary">
                    <strong>{ancestry.name}</strong>
                    <Button variant="ghost" size="sm" onClick={() => go("ancestry")}>Изменить происхождение</Button>
                  </div>
                  <Reference id={ancestry.articleId} label="Знаковые черты — получены автоматически" text={ancestry.signature} />
                  <div className="builder-section-head">
                    <h3>Черты за очки</h3>
                    <Chip tone={traitsSpent === ancestry.budget ? "green" : "accent"}>{traitsSpent} / {ancestry.budget}</Chip>
                  </div>
                  {ancestry.traits.map((t) => {
                    const chosen = draft.traits.includes(t.name);
                    return (
                      <div className={`builder-choice ${chosen ? "is-selected" : ""}`} key={t.name}>
                        <label>
                          <input type="checkbox" checked={chosen} disabled={!chosen && traitsSpent + t.cost > ancestry.budget}
                            onChange={() => patch({ traits: chosen ? draft.traits.filter((n) => n !== t.name) : [...draft.traits, t.name] })} />
                          <strong>{t.name}</strong><span className="muted small">{t.cost} очк.</span>
                        </label>
                        <RuleText text={t.text} />
                      </div>
                    );
                  })}
                  {ancestry.name === "Ревенант" && <p className="builder-notice">Черта «Предыдущая жизнь» требует выбора прошлого происхождения. Запишите этот выбор и его эффекты в особенностях на этапе «Настройка класса».</p>}
                  {skillSlots.ancestry.length > 0 && <SkillPicker label="Навыки происхождения" slots={skillSlots.ancestry} values={ancestrySkills} onChange={(ancestrySkills) => patch({ ancestrySkills })} />}
                </>
              ) : <p className="builder-notice">Сначала выберите происхождение.</p>}
            </>
          )}
          {step === "culture" && (
            <>
              <p className="builder-intro">
                Три аспекта сообщества, в котором вы выросли. Каждый даёт один
                навык.
              </p>
              {(["environment", "organization", "upbringing"] as const).map(
                (key, i) => {
                  const option = data.cultures[key].find(
                    (o) => o.name === draft.culture[key],
                  );
                  return (
                    <section className="builder-section" key={key}>
                      <Field
                        label={["Окружение", "Организация", "Воспитание"][i]}
                      >
                        <Select
                          value={draft.culture[key]}
                          onChange={(e) => {
                            const skills = [...draft.cultureSkills];
                            if (e.target.value !== draft.culture[key]) skills[i] = "";
                            patch({
                              culture: {
                                ...draft.culture,
                                [key]: e.target.value,
                              },
                              cultureSkills: skills,
                            });
                          }}
                        >
                          <option value="">Выберите аспект</option>
                          {data.cultures[key].map((o) => (
                            <option key={o.name}>{o.name}</option>
                          ))}
                        </Select>
                      </Field>
                      {option && (
                        <Reference id={option.articleId} text={option.text} />
                      )}
                    </section>
                  );
                },
              )}
              <SkillPicker
                label="Навыки культуры"
                slots={skillSlots.culture}
                values={draft.cultureSkills}
                prior={ancestrySkills}
                onChange={(cultureSkills) => patch({ cultureSkills })}
              />
              <Field label="Языки (через запятую)">
                <TextInput
                  value={draft.languages}
                  onChange={(e) => patch({ languages: e.target.value })}
                  placeholder="Выберите вместе с Ведущим"
                />
              </Field>
              <a href="#/codex/0505" target="_blank" rel="noreferrer">
                Примеры языков ↗
              </a>
            </>
          )}
          {step === "career" && (
            <>
              <p className="builder-intro">
                Выберите прошлую карьеру, чтобы раскрыть её полный текст прямо в карточке.
              </p>
              <div
                className="builder-option-grid builder-career-options"
                role="group"
                aria-label="Карьера"
              >
                {data.careers.map((c, index) => {
                  const selected = c.name === draft.career;
                  const detailsId = `builder-career-option-${index}-details`;
                  return (
                  <div className={`builder-option-card ${selected ? "is-expanded" : ""}`} key={c.name}>
                  <button
                    type="button"
                    className={`builder-option ${artFor("career", c.name) ? "with-art" : ""} ${selected ? "is-selected" : ""}`}
                    aria-pressed={selected}
                    aria-expanded={selected}
                    aria-controls={detailsId}
                    onClick={() => {
                      if (c.name !== draft.career) patch({ career: c.name, careerSkills: [], perkId: "", incident: "" });
                    }}
                  >
                    <Artwork kind="career" name={c.name} />
                    <strong>{c.name}</strong>
                    <span className="builder-option__snippet">{c.benefits.split("Вы получаете следующие преимущества карьеры:")[0].slice(0, 155)}…</span>
                  </button>
                  <section className="builder-option-details" id={detailsId} aria-label={`Описание карьеры: ${c.name}`} aria-hidden={!selected} inert={!selected}>
                    <div className="builder-option-details__content"><RuleText text={c.benefits.split("Вы получаете следующие преимущества карьеры:")[0]} /></div>
                  </section>
                  </div>
                )})}
              </div>
            </>
          )}
          {step === "career-options" && (
            <>
              {career ? (
                <>
                  <div className="builder-selection-summary">
                    <strong>{career.name}</strong>
                    <Button variant="ghost" size="sm" onClick={() => go("career")}>Изменить карьеру</Button>
                  </div>
                  <SkillPicker label="Навыки карьеры" slots={skillSlots.career} values={draft.careerSkills} prior={[...ancestrySkills, ...cultureSkills]} onChange={(careerSkills) => patch({ careerSkills })} />
                  <Field label="Перк карьеры">
                    <Select
                      value={draft.perkId}
                      onChange={(e) => patch({ perkId: e.target.value })}
                    >
                      <option value="">Выберите перк</option>
                      {PERK_COMPENDIUM.filter(
                        (p) => p.type === careerPerkType(draft.career),
                      ).map((p) => (
                        <option value={p.id} key={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  {draft.perkId && (
                    <RuleText
                      text={perkById(draft.perkId)?.description || ""}
                    />
                  )}
                  <Field label="Побуждающий инцидент">
                    <Select
                      value={draft.incident}
                      onChange={(e) => patch({ incident: e.target.value })}
                    >
                      <option value="">Что сделало вас героем?</option>
                      {career.incidents.map((incident, i) => (
                        <option value={incident} key={i}>
                          {incident.split(":")[0]}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  {draft.incident && (
                    <p className="builder-intro">{draft.incident}</p>
                  )}
                </>
              ) : <p className="builder-notice">Сначала выберите карьеру.</p>}
            </>
          )}
          {step === "class" && (
            <>
              <p className="builder-intro">
                Выберите класс, чтобы раскрыть его полное описание прямо в карточке.
              </p>
              <div className="builder-option-grid">
                {CLASS_PRESETS.map((c, index) => {
                  const source = data.classes.find((d) => d.name === c.name);
                  const selected = c.name === draft.className;
                  const expanded = selected && Boolean(source?.basics);
                  const detailsId = `builder-class-option-${index}-details`;
                  return (
                    <div className={`builder-option-card ${expanded ? "is-expanded" : ""}`} key={c.name}>
                    <button
                      type="button"
                      disabled={!source?.basics}
                      className={`builder-option ${artFor("class", c.name) ? "with-art" : ""} ${selected ? "is-selected" : ""}`}
                      aria-pressed={selected}
                      aria-expanded={expanded}
                      aria-controls={detailsId}
                      onClick={() => {
                        if (c.name !== draft.className) patch({
                          className: c.name,
                          characteristics: startingCharacteristics(c.name),
                          classSkills: [],
                          abilityIds: [],
                          subclass: "",
                          features: "",
                          featureChoices: {},
                          domain: "",
                          conduitDomainFeature: "",
                          kit: "",
                          secondaryKit: "",
                          meleeDamageKit: "",
                          rangedDamageKit: "",
                        });
                      }}
                    >
                      <Artwork kind="class" name={c.name} />
                      <strong>{c.name}</strong>
                      <span className="builder-option__snippet">
                        {source?.basics
                          ? `${source.summary.slice(0, 155)}${source.summary.length > 155 ? "…" : ""}`
                          : "Раздел пока пуст в переводе"}
                      </span>
                    </button>
                    <section className="builder-option-details" id={detailsId} aria-label={`Описание класса: ${source?.name ?? c.name}`} aria-hidden={!expanded} inert={!expanded}>
                      <div className="builder-option-details__content">{source?.basics && <RuleText text={source.summary} />}</div>
                    </section>
                    </div>
                  );
                })}
              </div>
            </>
          )}
          {step === "class-options" && (
            <>
              {preset ? (
                <>
                  <div className="builder-selection-summary">
                    <strong>{draft.className}</strong>
                    <Button variant="ghost" size="sm" onClick={() => go("class")}>Изменить класс</Button>
                  </div>
                  {draft.className === "Проводник" ? (
                    <div className="builder-skill-choices">
                      {[0, 1].map((i) => (
                        <Field key={i} label={`Домен ${i + 1}`}>
                          <Select
                            value={draft.subclass.split(", ")[i] || ""}
                            onChange={(e) => {
                              const values = draft.subclass.split(", ");
                              values[i] = e.target.value;
                              const subclass = values.join(", ");
                              const selectedDomains = subclass.split(",").map((name) => name.trim());
                              if (subclass !== draft.subclass) patch({
                                subclass,
                                classSkills: [],
                                conduitDomainFeature: selectedDomains.includes(draft.conduitDomainFeature)
                                  ? draft.conduitDomainFeature
                                  : "",
                              });
                            }}
                          >
                            <option value="">Выберите домен</option>
                            {classData?.subclasses
                              .filter(
                                (s) =>
                                  s.name !== draft.subclass.split(", ")[1 - i],
                              )
                              .map((s) => (
                                <option key={s.name}>{s.name}</option>
                              ))}
                          </Select>
                        </Field>
                      ))}
                    </div>
                  ) : (
                    <Field label="Подкласс">
                      <Select
                        value={draft.subclass}
                        onChange={(e) =>
                          patch({
                            subclass: e.target.value,
                            classSkills: [],
                            kit: "",
                            secondaryKit: "",
                          })
                        }
                      >
                        <option value="">Выберите подкласс</option>
                        {classData?.subclasses.map((s) => (
                          <option key={s.name}>{s.name}</option>
                        ))}
                      </Select>
                    </Field>
                  )}
                  {draft.className === "Проводник" && (
                    <Field label="Домен для особенности 1-го уровня">
                      <Select
                        value={draft.conduitDomainFeature}
                        onChange={(e) => patch({ conduitDomainFeature: e.target.value })}
                      >
                        <option value="">Выберите домен</option>
                        {draft.subclass.split(",").map((name) => name.trim()).filter(Boolean).map((name) => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                      </Select>
                    </Field>
                  )}
                  {classData?.subclasses.find((s) => s.name === draft.subclass)
                    ?.text && (
                    <RuleText
                      text={
                        classData.subclasses.find(
                          (s) => s.name === draft.subclass,
                        )!.text
                      }
                    />
                  )}
                  <Reference
                    id={classData?.articleId}
                    label="Особенности класса и дополнительные выборы"
                    text={classData?.features || ""}
                  />
                  {draft.className === "Цензор" && (
                    <Field label="Домен цензора">
                      <Select
                        value={draft.domain}
                        onChange={(e) =>
                          patch({ domain: e.target.value, classSkills: [] })
                        }
                      >
                        <option value="">Выберите домен</option>
                        {data.classes
                          .find((c) => c.name === "Проводник")
                          ?.subclasses.map((s) => (
                            <option key={s.name}>{s.name}</option>
                          ))}
                      </Select>
                    </Field>
                  )}
                  <CharacteristicAllocator
                    className={draft.className}
                    value={draft.characteristics}
                    onChange={(characteristics) => patch({ characteristics })}
                  />
                  <SkillPicker
                    label="Навыки класса"
                    slots={skillSlots.class}
                    values={draft.classSkills}
                    prior={[...ancestrySkills, ...cultureSkills, ...careerSkills]}
                    onChange={(classSkills) => patch({ classSkills })}
                  />
                  {classData?.featureChoices.map((group) => {
                    const chosenName = draft.featureChoices[group.name];
                    const chosenOption = group.options.find(
                      (option) => option.name === chosenName,
                    );
                    const registryOption = classFeatureGroups(
                      draft.className,
                    )
                      .find((item) => item.name === group.name)
                      ?.options.find((item) => item.name === chosenName);
                    const equipmentRequirement = featureEquipmentRequirements(draft.className, {
                      ...(draft.className === "Проводник" && group.name === "Молитва" ? { "conduit.prayer": chosenName } : {}),
                      ...(draft.className === "Талант" && group.name === "Псионическая аугментация" ? { "talent.augmentation": chosenName } : {}),
                      ...(draft.className === "Элементалист" && group.name === "Зачарование" ? { "elementalist.enchantment": chosenName } : {}),
                    });
                    return (
                      <section className="builder-section" key={group.name}>
                        <Field label={group.name}>
                          <Select
                            value={draft.featureChoices[group.name] || ""}
                            onChange={(e) =>
                              patch({
                                featureChoices: {
                                  ...draft.featureChoices,
                                  [group.name]: e.target.value,
                                },
                              })
                            }
                          >
                            <option value="">Выберите особенность</option>
                            {group.options.map((o) => (
                              <option key={o.name}>{o.name}</option>
                            ))}
                          </Select>
                        </Field>
                        <Reference
                          text={group.text}
                          label="Как работает этот выбор"
                        />
                        {chosenOption && (
                          <>
                            {registryOption && (
                              <p className="muted small">
                                {classFeatureOptionAutomated(
                                  draft.className,
                                  registryOption.name,
                                )
                                  ? "Поддерживает авторасчёт"
                                  : `По тексту правил${registryOption.manualReason ? `: ${registryOption.manualReason}` : ""}`}
                              </p>
                            )}
                            {(registryOption?.effects.some((effect) => effect.kind === "field" && effect.when?.equipment) || equipmentRequirement) && (
                              <FeatureEquipmentFields
                                value={draft.equipment}
                                hasKit={Boolean(hero.kit.trim() || hero.secondaryKit?.trim())}
                                automationEnabled={hero.automation?.enabled ?? false}
                                onChange={(equipment) => patch({ equipment })}
                              />
                            )}
                            <RuleText text={chosenOption.text} />
                          </>
                        )}
                      </section>
                    );
                  })}
                  <Field label="Выбранные особенности класса">
                    <TextArea
                      rows={5}
                      value={draft.features}
                      onChange={(e) => patch({ features: e.target.value })}
                      placeholder="Запишите домены, доктрину, традицию и другие выборы из текста класса"
                    />
                  </Field>
                </>
                  ) : <p className="builder-notice">Сначала выберите класс.</p>}
            </>
          )}
          {step === "kit" && (
            <>
              {canUseKit(draft.className, draft.subclass) ? (
                <>
                  <p className="builder-intro">
                    Комплект даёт снаряжение, бонусы и знаковую способность. Они
                    попадут в лист автоматически.
                  </p>
                  {draft.className === "Тактик" && (
                    <Field label="Второй комплект · Полевой арсенал">
                      <Select
                        value={draft.secondaryKit}
                        onChange={(e) =>
                          patch({ secondaryKit: e.target.value })
                        }
                      >
                        <option value="">Выберите второй комплект</option>
                        {KIT_COMPENDIUM.filter((k) => k.name !== draft.kit).map(
                          (k) => (
                            <option key={k.id}>{k.name}</option>
                          ),
                        )}
                      </Select>
                    </Field>
                  )}
                  <div className="builder-option-grid">
                    {KIT_COMPENDIUM.map((k) => (
                      <button
                        type="button"
                        disabled={k.name === draft.secondaryKit}
                        className={`builder-option ${artFor("kit", k.name) ? "with-art" : ""} ${draft.kit === k.name ? "is-selected" : ""}`}
                        aria-pressed={draft.kit === k.name}
                        key={k.id}
                        onClick={() => patch({ kit: k.name })}
                      >
                        <Artwork kind="kit" name={k.name} />
                        <strong>{k.name}</strong>
                        <span>{k.equipment}</span>
                        <span>
                          {k.bonuses
                            .map((b) => `${kitBonusLabel(b.label)} ${b.value}`)
                            .join(" · ")}
                        </span>
                        <span>Знаковая: {k.signatureAbility}</span>
                      </button>
                    ))}
                  </div>
                  {draft.secondaryKit &&
                    (["meleeDamageKit", "rangedDamageKit"] as const).map(
                      (key, i) => (
                        <Field
                          key={key}
                          label={`Бонус к урону ${i === 0 ? "ближнего" : "дальнего"} боя — от одного комплекта`}
                        >
                          <Select
                            value={draft[key] || draft.kit}
                            onChange={(e) => patch({ [key]: e.target.value })}
                          >
                            {[draft.kit, draft.secondaryKit]
                              .filter(Boolean)
                              .map((name) => (
                                <option key={name}>{name}</option>
                              ))}
                          </Select>
                        </Field>
                      ),
                    )}
                </>
              ) : (
                <p className="builder-intro">
                  Этот класс не предоставляет комплект на 1-м уровне. Его
                  собственные особенности снаряжения описаны в разделе класса.
                </p>
              )}
              <Reference
                id="0901"
                label="Как работают бонусы комплекта"
                text="Бонус к выносливости умножается на эшелон героя. Урон и дистанция знаковой способности уже включают бонусы её комплекта. У тактика одинаковые преимущества двух комплектов не складываются; профиль бонуса к урону выбирается целиком от одного комплекта."
              />
            </>
          )}
          {step === "abilities" && (
            <>
              <p className="builder-intro">
                Свободные удары, способности комплектов и обязательные
                способности класса уже добавлены. Выберите остальные
                способности.
              </p>
              {grantedAbilities.length > 0 && (
                <p className="builder-notice">
                  От класса и подкласса:{" "}
                  {grantedAbilities.map((a) => a.name).join(", ")}
                </p>
              )}
              {abilityGroups
                .filter((g) => g.entries.length > 0)
                .map((group) => (
                  <section className="builder-section" key={group.label}>
                    <div className="builder-section-head">
                      <h3>{group.label}</h3>
                      <span className="muted small">
                        {group.count === null
                          ? "По особенностям класса и подкласса"
                          : `Выберите ${group.count}`}
                      </span>
                    </div>
                    <div className="builder-ability-grid">
                      {group.entries.map((a) => {
                        const chosen = draft.abilityIds.includes(a.id);
                        const full =
                          group.count !== null &&
                          group.entries.filter((a) =>
                            draft.abilityIds.includes(a.id),
                          ).length >= group.count;
                        const fullText = [
                          a.flavor && `Описание:\n${a.flavor}`,
                          a.trigger && `Триггер:\n${a.trigger}`,
                          ...a.tiers.map((tier, index) =>
                            tier.effect ? `Тир ${index + 1}:\n${tier.effect}` : "",
                          ),
                          a.effect && `Эффект:\n${a.effect}`,
                          a.notes && `Примечания:\n${a.notes}`,
                        ]
                          .filter(Boolean)
                          .join("\n\n");
                        return (
                          <AbilityCard
                            key={a.id}
                            ability={a}
                            character={hero}
                            className={
                              chosen ? "is-selected" : "builder-ability-option"
                            }
                            footerAction={(
                              <label className="builder-ability-select">
                                <input
                                  type="checkbox"
                                  checked={chosen}
                                  disabled={!chosen && full}
                                  aria-label={`${chosen ? "Снять выбор" : "Выбрать"}: ${a.name}`}
                                  onChange={() =>
                                    patch({
                                      abilityIds: chosen
                                        ? draft.abilityIds.filter(
                                            (id) => id !== a.id,
                                          )
                                        : [...draft.abilityIds, a.id],
                                    })
                                  }
                                />
                                {chosen ? "Выбрано" : "Выбрать"}
                              </label>
                            )}
                            details={(
                              <Reference
                                label="Полный текст способности"
                                text={fullText}
                              />
                            )}
                          />
                        );
                      })}
                    </div>
                  </section>
                ))}
            </>
          )}
          {step === "details" && (
            <>
              <p className="builder-intro">
                Добавьте характер, связи и, если хотите, нюанс. Эти решения
                делают героя вашим.
              </p>
              <Field label="Нюанс (необязательно)">
                <Select
                  value={draft.complication}
                  onChange={(e) => patch({ complication: e.target.value })}
                >
                  <option value="">Без нюанса</option>
                  {data.complications.map((c) => (
                    <option key={c.name}>{c.name}</option>
                  ))}
                </Select>
              </Field>
              {draft.complication && (
                <RuleText
                  text={
                    data.complications.find(
                      (c) => c.name === draft.complication,
                    )?.text || ""
                  }
                />
              )}
              <Field label="Языки культуры и карьеры (через запятую)">
                <TextInput
                  value={draft.languages}
                  onChange={(e) => patch({ languages: e.target.value })}
                />
              </Field>
              <Field label="Внешность, характер, цели">
                <TextArea
                  value={draft.details}
                  onChange={(e) => patch({ details: e.target.value })}
                  rows={4}
                />
              </Field>
              <Field label="Связи с другими героями">
                <TextArea
                  value={draft.connections}
                  onChange={(e) => patch({ connections: e.target.value })}
                  rows={3}
                />
              </Field>
            </>
          )}
          {step === "summary" && (
            <>
              <p className="builder-intro">
                Проверьте выборы. После создания все разделы листа можно
                редактировать.
              </p>
              <div className="builder-review">
                {STEPS.filter(({ id }) => id !== "summary").map(({ id, label }) => (
                  <button type="button" onClick={() => go(id)} key={id}>
                    <span>
                      {issues[id] ? "○" : "✓"} {label}
                    </span>
                    <span className="muted small">
                      {issues[id] || "Заполнено"} →
                    </span>
                  </button>
                ))}
              </div>
              <div className="builder-notice">
                <strong>Проверьте особенности своего класса</strong>
                <p>
                  Подклассы, домены, эффекты нюансов и ситуационные черты
                  сохраняются текстом. Их особые условия и бонусы нужно
                  применять по книге. Постоянные поправки можно внести в лист —
                  авторасчёт их запомнит.
                </p>
              </div>
              <p className="muted small">
                Автоматически: выносливость и восстановления класса, бонусы
                комплектов, числовые черты происхождения, урон оружия,
                дистанции, значение восстановления, потенциал и пороги тиров.
              </p>
            </>
          )}
          {((showIssues && issues[step]) || error) && (
            <p className="builder-error" role="alert">
              {error || issues[step]}
            </p>
          )}
        </div>
        <aside
          className="builder-preview"
          aria-label="Предварительный лист героя"
        >
          <span className="eyebrow">Ваш герой</span>
          <h2>{hero.name}</h2>
          <p>
            {[hero.ancestry, hero.className].filter(Boolean).join(" · ") ||
              "История начинается здесь"}
          </p>
          <div className="builder-preview-stats">
            {CHARACTERISTICS.map((c) => (
              <div key={c.key}>
                <span>{c.short}</span>
                <strong>
                  {hero.characteristics[c.key] > 0 ? "+" : ""}
                  {hero.characteristics[c.key]}
                </strong>
              </div>
            ))}
          </div>
          <dl>
            <div>
              <dt>Выносливость</dt>
              <dd>{hero.stamina.max}</dd>
            </div>
            <div>
              <dt>Восстановления</dt>
              <dd>
                {hero.recoveries.max} × {derived.recoveryValue}
              </dd>
            </div>
            <div>
              <dt>Скорость</dt>
              <dd>{hero.speed}</dd>
            </div>
            <div>
              <dt>Устойчивость</dt>
              <dd>{hero.stability}</dd>
            </div>
            <div>
              <dt>Ресурс</dt>
              <dd>{hero.heroicResource.name}</dd>
            </div>
          </dl>
          {hero.career && (
            <div>
              <span className="eyebrow">Карьера</span>
              <p>{hero.career}</p>
            </div>
          )}
          {hero.kit && (
            <div>
              <span className="eyebrow">Комплекты</span>
              <p>{[hero.kit, hero.secondaryKit].filter(Boolean).join(", ")}</p>
            </div>
          )}
          {hero.skills.length > 0 && (
            <div>
              <span className="eyebrow">Навыки · {hero.skills.length}</span>
              <p className="small">{hero.skills.join(", ")}</p>
            </div>
          )}
          <div>
            <span className="eyebrow">
              Способности · {hero.abilities.length}
            </span>
            <p className="small">
              {hero.abilities
                .filter(
                  (a) => !seed.current.abilities.some((b) => b.id === a.id),
                )
                .map((a) => a.name)
                .join(", ") || "Свободные удары и базовые действия"}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setDraft(emptyBuilderDraft());
              go("concept");
            }}
            disabled={busy}
          >
            Начать заново
          </Button>
        </aside>
      </div>
    </Modal>
  );
}
