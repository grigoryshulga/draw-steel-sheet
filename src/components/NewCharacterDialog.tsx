import { useEffect, useMemo, useRef, useState } from "react";
import {
  BUILDER_DATA as data,
  buildCharacter,
  builderSkillSlots,
  emptyBuilderDraft,
  selectedSkills,
  grantedClassAbilities,
  startingCharacteristics,
  builderIssues,
  type BuilderDraft,
} from "../lib/character-builder";
import { CLASS_PRESETS, classPreset } from "../data/classes";
import { ABILITY_COMPENDIUM } from "../data/compendium";
import { KIT_COMPENDIUM, kitBonusLabel } from "../data/kits";
import { careerPerkType, PERK_COMPENDIUM, perkById } from "../data/perks";
import {
  ALL_CREATION_SKILLS,
  CLASS_SIGNATURE_COUNTS,
  canUseKit,
  type SkillSlot,
} from "../data/creation-rules";
import { createCharacter } from "../lib/defaults";
import {
  CHARACTERISTICS,
  deriveStats,
  evaluateAbilityDamage,
} from "../lib/rules";
import type { Character, CompendiumAbility } from "../types";
import { Button, Chip, Field, Modal, Select, TextArea, TextInput } from "./ui";
import { RuleText } from "./RuleText";
import { Artwork } from "./Artwork";
import { artFor } from "../lib/art";
import "../views/CodexView.css";
import "./NewCharacterDialog.css";

const DRAFT_KEY = "ds-builder-draft-v1";
const STEPS = [
  "Замысел",
  "Происхождение",
  "Культура",
  "Карьера",
  "Класс",
  "Комплект",
  "Способности",
  "Детали",
  "Готовый герой",
];
function readDraft(): BuilderDraft {
  try {
    const stored = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
    if (
      stored?.version === 1 &&
      Array.isArray(stored.traits) &&
      Array.isArray(stored.abilityIds)
    ) {
      const base = emptyBuilderDraft();
      return {
        ...base,
        ...stored,
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
function SkillChoices({
  slots,
  values,
  onChange,
  prior = [],
}: {
  slots: SkillSlot[];
  values: string[];
  onChange: (values: string[]) => void;
  prior?: string[];
}) {
  return (
    <div className="builder-skill-choices">
      {slots.map((slot, i) => {
        const previousValues = slots
          .slice(0, i)
          .map((s, j) => values[j] || s.fixed || "");
        const duplicate =
          slot.fixed && [...prior, ...previousValues].includes(slot.fixed);
        const options = duplicate ? ALL_CREATION_SKILLS : slot.options;
        const value = values[i] || (!duplicate ? slot.fixed : "") || "";
        const otherValues = slots.flatMap((s, j) =>
          j !== i ? [values[j] || s.fixed || ""] : [],
        );
        return (
          <Field
            key={i}
            label={
              duplicate
                ? `${slot.fixed} уже есть — выберите замену`
                : `${slot.label} ${i + 1}`
            }
          >
            <Select
              value={value}
              onChange={(e) => {
                const next = [...values];
                next[i] = e.target.value;
                onChange(next);
              }}
            >
              <option value="">Выберите навык</option>
              {options
                .filter(
                  (s) =>
                    s === value ||
                    (!prior.includes(s) && !otherValues.includes(s)),
                )
                .map((s) => (
                  <option key={s}>{s}</option>
                ))}
            </Select>
          </Field>
        );
      })}
    </div>
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
  const [draft, setDraft] = useState(readDraft);
  const [step, setStep] = useState(() => {
    try {
      return Math.min(
        8,
        Math.max(0, Number(localStorage.getItem("ds-builder-step-v1")) || 0),
      );
    } catch {
      return 0;
    }
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showIssues, setShowIssues] = useState(false);
  const seed = useRef(createCharacter());
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
  const cultureSkills = selectedSkills(skillSlots.culture, draft.cultureSkills);
  const careerSkills = selectedSkills(skillSlots.career, draft.careerSkills);
  const traitsSpent =
    ancestry?.traits
      .filter((t) => draft.traits.includes(t.name))
      .reduce((sum, t) => sum + t.cost, 0) ?? 0;
  const grantedAbilities = grantedClassAbilities(draft);
  const classAbilities = ABILITY_COMPENDIUM.filter(
    (a) =>
      a.className === draft.className &&
      a.level === 1 &&
      !grantedAbilities.some((g) => g.id === a.id),
  );
  const signatureCount = CLASS_SIGNATURE_COUNTS[draft.className] ?? 0;
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      /* in-memory draft remains available */
    }
  }, [draft]);
  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0 });
    try {
      localStorage.setItem("ds-builder-step-v1", String(step));
    } catch {
      /* no storage */
    }
  }, [step]);
  const issues = builderIssues(draft);
  const go = (next: number) => {
    setStep(next);
    setError("");
    setShowIssues(false);
  };
  const submit = async (blank = false) => {
    const invalid = issues.findIndex(Boolean);
    if (!blank && invalid >= 0) {
      go(invalid);
      setShowIssues(true);
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onCreate(blank ? createCharacter({ name: draft.name }) : hero);
      setDraft(emptyBuilderDraft());
      setStep(0);
      seed.current = createCharacter();
      try {
        localStorage.removeItem(DRAFT_KEY);
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
          {step > 0 && (
            <Button onClick={() => go(step - 1)} disabled={busy}>
              Назад
            </Button>
          )}
          <Button
            variant="primary"
            disabled={busy}
            onClick={() =>
              step === 8
                ? void submit()
                : issues[step]
                  ? setShowIssues(true)
                  : go(step + 1)
            }
          >
            {busy ? "Создание…" : step === 8 ? "Создать героя" : "Далее →"}
          </Button>
        </>
      }
    >
      <div className="builder-layout">
        <nav className="builder-steps" aria-label="Этапы создания героя">
          {STEPS.map((label, i) => (
            <button
              key={label}
              type="button"
              aria-current={step === i ? "step" : undefined}
              className={step === i ? "is-active" : ""}
              onClick={() => go(i)}
            >
              <span>
                {!issues[i] && i !== 8 ? "✓" : String(i + 1).padStart(2, "0")}
              </span>
              {label}
            </button>
          ))}
        </nav>
        <div className="builder-content" ref={contentRef}>
          <span className="eyebrow">
            Шаг {step + 1} из {STEPS.length} · Герой 1-го уровня
          </span>
          <h2 className="builder-step-title">{STEPS[step]}</h2>
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
          {step === 0 && (
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
          {step === 1 && (
            <>
              <p className="builder-intro">
                Происхождение определяет физиологию и знаковые черты. Остальные
                черты выбираются за очки.
              </p>
              <div className="builder-option-grid">
                {data.ancestries.map((a) => (
                  <button
                    type="button"
                    className={`builder-option ${artFor("ancestry", a.name) ? "with-art" : ""} ${a.name === draft.ancestry ? "is-selected" : ""}`}
                    aria-pressed={a.name === draft.ancestry}
                    key={a.name}
                    onClick={() => patch({ ancestry: a.name, traits: [] })}
                  >
                    <Artwork kind="ancestry" name={a.name} />
                    <strong>{a.name}</strong>
                    <span>{a.summary.slice(0, 150)}…</span>
                  </button>
                ))}
              </div>
              {ancestry && (
                <>
                  <Reference
                    id={ancestry.articleId}
                    label="Знаковые черты — получены автоматически"
                    text={ancestry.signature}
                  />
                  <div className="builder-section-head">
                    <h3>Черты за очки</h3>
                    <Chip
                      tone={
                        traitsSpent === ancestry.budget ? "green" : "accent"
                      }
                    >
                      {traitsSpent} / {ancestry.budget}
                    </Chip>
                  </div>
                  {ancestry.traits.map((t) => {
                    const chosen = draft.traits.includes(t.name);
                    return (
                      <div
                        className={`builder-choice ${chosen ? "is-selected" : ""}`}
                        key={t.name}
                      >
                        <label>
                          <input
                            type="checkbox"
                            checked={chosen}
                            disabled={
                              !chosen && traitsSpent + t.cost > ancestry.budget
                            }
                            onChange={() =>
                              patch({
                                traits: chosen
                                  ? draft.traits.filter((n) => n !== t.name)
                                  : [...draft.traits, t.name],
                              })
                            }
                          />
                          <strong>{t.name}</strong>
                          <span className="muted small">{t.cost} очк.</span>
                        </label>
                        <RuleText text={t.text} />
                      </div>
                    );
                  })}
                  {ancestry.name === "Ревенант" && (
                    <p className="builder-notice">
                      Черта «Предыдущая жизнь» требует выбора прошлого
                      происхождения. Запишите этот выбор и его эффекты в
                      особенностях на этапе «Класс».
                    </p>
                  )}
                </>
              )}
            </>
          )}
          {step === 2 && (
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
                            skills[i] = "";
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
                        <>
                          <Reference id={option.articleId} text={option.text} />
                          <SkillChoices
                            slots={[skillSlots.culture[i]]}
                            values={[draft.cultureSkills[i] || ""]}
                            prior={draft.cultureSkills.filter(
                              (_, j) => j !== i,
                            )}
                            onChange={(values) => {
                              const skills = [...draft.cultureSkills];
                              skills[i] = values[0];
                              patch({ cultureSkills: skills });
                            }}
                          />
                        </>
                      )}
                    </section>
                  );
                },
              )}
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
          {step === 3 && (
            <>
              <p className="builder-intro">
                Кем вы были до приключений? Карьера даёт навыки, перк и
                побуждающий инцидент.
              </p>
              <div
                className="builder-option-grid builder-career-options"
                role="group"
                aria-label="Карьера"
              >
                {data.careers.map((c) => (
                  <button
                    type="button"
                    key={c.name}
                    className={`builder-option ${artFor("career", c.name) ? "with-art" : ""} ${c.name === draft.career ? "is-selected" : ""}`}
                    aria-pressed={c.name === draft.career}
                    onClick={() =>
                      patch({
                        career: c.name,
                        careerSkills: [],
                        perkId: "",
                        incident: "",
                      })
                    }
                  >
                    <Artwork kind="career" name={c.name} />
                    <strong>{c.name}</strong>
                    <span>{c.benefits.split("\n")[0].slice(0, 150)}…</span>
                  </button>
                ))}
              </div>
              {career && (
                <>
                  <Reference id={career.articleId} text={career.benefits} />
                  <SkillChoices
                    slots={skillSlots.career}
                    values={draft.careerSkills}
                    prior={cultureSkills}
                    onChange={(careerSkills) => patch({ careerSkills })}
                  />
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
              )}
            </>
          )}
          {step === 4 && (
            <>
              <p className="builder-intro">
                Класс определяет вашу роль в бою, характеристики и героический
                ресурс.
              </p>
              <div className="builder-option-grid">
                {CLASS_PRESETS.map((c) => {
                  const source = data.classes.find((d) => d.name === c.name);
                  return (
                    <button
                      type="button"
                      disabled={!source?.basics}
                      className={`builder-option ${artFor("class", c.name) ? "with-art" : ""} ${c.name === draft.className ? "is-selected" : ""}`}
                      aria-pressed={c.name === draft.className}
                      key={c.name}
                      onClick={() =>
                        patch({
                          className: c.name,
                          characteristics: startingCharacteristics(c.name),
                          classSkills: [],
                          abilityIds: [],
                          subclass: "",
                          features: "",
                          featureChoices: {},
                          domain: "",
                          kit: "",
                          secondaryKit: "",
                          meleeDamageKit: "",
                          rangedDamageKit: "",
                        })
                      }
                    >
                      <Artwork kind="class" name={c.name} />
                      <strong>{c.name}</strong>
                      <span>
                        {source?.basics
                          ? source.summary.slice(0, 150) + "…"
                          : "Раздел пока пуст в переводе"}
                      </span>
                    </button>
                  );
                })}
              </div>
              {preset && (
                <>
                  <Reference
                    id={classData?.articleId}
                    text={classData?.basics || ""}
                    label="Начальные характеристики и навыки из книги"
                  />
                  <h3>Распределите характеристики</h3>
                  <p className="muted small">
                    Фиксированные значения заданы классом. Остальные
                    распределите по одному из наборов в тексте выше.
                  </p>
                  <div className="builder-characteristics">
                    {CHARACTERISTICS.map((meta) => (
                      <Field key={meta.key} label={meta.label}>
                        <Select
                          aria-label={`Начальная ${meta.label}`}
                          disabled={meta.key in preset.starting}
                          value={draft.characteristics[meta.key]}
                          onChange={(e) =>
                            patch({
                              characteristics: {
                                ...draft.characteristics,
                                [meta.key]: Number(e.target.value),
                              },
                            })
                          }
                        >
                          {[-1, 0, 1, 2].map((v) => (
                            <option key={v} value={v}>
                              {v > 0 ? "+" : ""}
                              {v}
                            </option>
                          ))}
                        </Select>
                      </Field>
                    ))}
                  </div>
                  <SkillChoices
                    slots={skillSlots.class}
                    values={draft.classSkills}
                    prior={[...cultureSkills, ...careerSkills]}
                    onChange={(classSkills) => patch({ classSkills })}
                  />
                  {draft.className === "Проводник" ? (
                    <div className="builder-skill-choices">
                      {[0, 1].map((i) => (
                        <Field key={i} label={`Домен ${i + 1}`}>
                          <Select
                            value={draft.subclass.split(", ")[i] || ""}
                            onChange={(e) => {
                              const values = draft.subclass.split(", ");
                              values[i] = e.target.value;
                              patch({ subclass: values.join(", ") });
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
                  {classData?.featureChoices.map((group) => (
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
                      {group.options.find(
                        (o) => o.name === draft.featureChoices[group.name],
                      ) && (
                        <RuleText
                          text={
                            group.options.find(
                              (o) =>
                                o.name === draft.featureChoices[group.name],
                            )!.text
                          }
                        />
                      )}
                    </section>
                  ))}
                  <Field label="Выбранные особенности класса">
                    <TextArea
                      rows={5}
                      value={draft.features}
                      onChange={(e) => patch({ features: e.target.value })}
                      placeholder="Запишите домены, доктрину, традицию и другие выборы из текста класса"
                    />
                  </Field>
                </>
              )}
            </>
          )}
          {step === 5 && (
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
          {step === 6 && (
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
                    {group.entries.map((a) => {
                      const chosen = draft.abilityIds.includes(a.id);
                      const full =
                        group.count !== null &&
                        group.entries.filter((a) =>
                          draft.abilityIds.includes(a.id),
                        ).length >= group.count;
                      return (
                        <div
                          key={a.id}
                          className={`builder-choice ${chosen ? "is-selected" : ""}`}
                        >
                          <label>
                            <input
                              type="checkbox"
                              checked={chosen}
                              disabled={!chosen && full}
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
                            <strong>{a.name}</strong>
                            <span className="muted small">{a.distance}</span>
                          </label>
                          <p className="muted small">{a.flavor}</p>
                          <div className="builder-ability-tiers">
                            {a.tiers.map((t, i) => (
                              <span key={i}>
                                <b>Т{i + 1}</b>{" "}
                                {evaluateAbilityDamage(a, i + 1, hero).display}{" "}
                                {t.effect}
                              </span>
                            ))}
                          </div>
                          {a.effect && (
                            <Reference
                              label="Эффект способности"
                              text={a.effect}
                            />
                          )}
                        </div>
                      );
                    })}
                  </section>
                ))}
            </>
          )}
          {step === 7 && (
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
          {step === 8 && (
            <>
              <p className="builder-intro">
                Проверьте выборы. После создания все разделы листа можно
                редактировать.
              </p>
              <div className="builder-review">
                {STEPS.slice(0, 8).map((label, i) => (
                  <button type="button" onClick={() => go(i)} key={label}>
                    <span>
                      {issues[i] ? "○" : "✓"} {label}
                    </span>
                    <span className="muted small">
                      {issues[i] || "Заполнено"} →
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
              go(0);
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
