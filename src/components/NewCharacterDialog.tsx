import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildCharacter,
  builderSkillSlots,
  emptyBuilderDraft,
  selectedSkills,
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
import { BUILDER_DRAFT_KEY, readBuilderDraft, scopedStorageKey } from "../lib/builder-draft";
import { createCharacter } from "../lib/defaults";
import { CHARACTERISTICS, deriveStats } from "../lib/rules";
import type { Ability, Character, Perk } from "../types";
import { useStorageScope } from "../state/StorageScope";
import { Button, Modal } from "./ui";
import { RuleText } from "./RuleText";
import { AbilityCard } from "./AbilityCard";
import { PerkDetailModal } from "./PerkDetailModal";
import { BuilderPreview } from "./builder/BuilderPreview";
import {
  BuilderStepProvider,
  type BuilderStepContextValue,
} from "./builder/BuilderStepContext";
import { ConceptStep } from "./builder/steps/ConceptStep";
import { AncestryStep } from "./builder/steps/AncestryStep";
import { AncestryOptionsStep } from "./builder/steps/AncestryOptionsStep";
import { CultureStep } from "./builder/steps/CultureStep";
import { CareerStep } from "./builder/steps/CareerStep";
import { CareerOptionsStep } from "./builder/steps/CareerOptionsStep";
import { ClassStep } from "./builder/steps/ClassStep";
import { ClassOptionsStep } from "./builder/steps/ClassOptionsStep";
import { KitStep } from "./builder/steps/KitStep";
import { AbilitiesStep } from "./builder/steps/AbilitiesStep";
import { DetailsStep } from "./builder/steps/DetailsStep";
import { SummaryStep } from "./builder/steps/SummaryStep";
import "../views/CodexView.css";
import "./NewCharacterDialog.css";
import "./BuilderPage.css";

const STEPS = BUILDER_STEPS;

export function NewCharacterDialog({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (character: Character) => Promise<void> | void;
}) {
  const scope = useStorageScope();
  const draftKey = scopedStorageKey(BUILDER_DRAFT_KEY, scope);
  const stepKey = scopedStorageKey(BUILDER_STEP_V2_KEY, scope);
  const legacyStepKey = scopedStorageKey(LEGACY_BUILDER_STEP_V1_KEY, scope);
  const [draft, setDraft] = useState(() => readBuilderDraft(draftKey));
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
  const [perkDetail, setPerkDetail] = useState<Perk | null>(null);
  const [traitDetail, setTraitDetail] = useState<{ name: string; text: string } | null>(null);
  const [incidentDetail, setIncidentDetail] = useState<{ title: string; text: string } | null>(null);
  const [subclassDetail, setSubclassDetail] = useState<{ title: string; text: string } | null>(null);
  const [abilityDetail, setAbilityDetail] = useState<Ability | null>(null);
  const seed = useRef(createCharacter());
  const stepsRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const hero = useMemo(() => buildCharacter(draft, seed.current), [draft]);
  const derived = deriveStats(hero);
  const patch = (changes: Partial<BuilderDraft>) => {
    setDraft((current) => ({ ...current, ...changes }));
    setError("");
  };
  const skillSlots = builderSkillSlots(draft);
  const ancestrySkills = selectedSkills(skillSlots.ancestry, draft.ancestrySkills || []);
  const cultureSkills = selectedSkills(skillSlots.culture, draft.cultureSkills, ancestrySkills);
  const careerSkills = selectedSkills(skillSlots.career, draft.careerSkills, [...ancestrySkills, ...cultureSkills]);
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
    if (!nav) return;

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
  }, [step]);
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
  const stepContext: BuilderStepContextValue = {
    draft,
    patch,
    go,
    issues,
    hero,
    skillSlots,
    ancestrySkills,
    cultureSkills,
    careerSkills,
    busy,
    createBlankCharacter: () => void submit(true),
    openPerk: setPerkDetail,
    openTrait: setTraitDetail,
    openIncident: setIncidentDetail,
    openSubclass: setSubclassDetail,
    openAbility: setAbilityDetail,
  };
  return (
    <>
    <div className="builder-page-shell">
      <header className="builder-page-head">
        <div className="builder-page-heading">
          <h1 className="builder-page-title">Создание героя</h1>
        </div>
        <div className="builder-page-head-actions">
          <span className="builder-draft-label muted small">
            Черновик сохраняется в этом браузере
          </span>
          <Button variant="ghost" icon="close" onClick={onClose} disabled={busy}>
            Продолжить позже
          </Button>
        </div>
      </header>
      <div className="builder-page-body">
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
          <BuilderStepProvider value={stepContext}>
            {step === "concept" && <ConceptStep />}
            {step === "ancestry" && <AncestryStep />}
            {step === "ancestry-options" && <AncestryOptionsStep />}
            {step === "culture" && <CultureStep />}
            {step === "career" && <CareerStep />}
            {step === "career-options" && <CareerOptionsStep />}
            {step === "class" && <ClassStep />}
            {step === "class-options" && <ClassOptionsStep />}
            {step === "kit" && <KitStep />}
            {step === "abilities" && <AbilitiesStep />}
            {step === "details" && <DetailsStep />}
            {step === "summary" && <SummaryStep />}
          </BuilderStepProvider>
          {((showIssues && issues[step]) || error) && (
            <p className="builder-error" role="alert">
              {error || issues[step]}
            </p>
          )}
        </div>
        <BuilderPreview
          hero={hero}
          derived={derived}
          seedAbilities={seed.current.abilities}
          busy={busy}
          onReset={() => {
            setDraft(emptyBuilderDraft());
            go("concept");
          }}
        />
      </div>
      </div>
      <footer className="builder-page-footer">
        <span className="builder-footer-step muted small">
          Шаг {builderStepIndex(step) + 1} из {STEPS.length} ·{" "}
          {STEPS[builderStepIndex(step)].label}
        </span>
        <div className="builder-page-footer-actions">
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
        </div>
      </footer>
    </div>
    <PerkDetailModal
      open={Boolean(perkDetail)}
      onClose={() => setPerkDetail(null)}
      name={perkDetail?.name ?? ""}
      type={perkDetail?.type}
      summary={perkDetail?.summary}
      description={perkDetail?.description}
    />
    <Modal
      open={Boolean(traitDetail)}
      onClose={() => setTraitDetail(null)}
      title={traitDetail ? `Черта: ${traitDetail.name}` : "Черта"}
      footer={
        <>
          <span className="grow" />
          <Button variant="primary" onClick={() => setTraitDetail(null)}>
            Закрыть
          </Button>
        </>
      }
    >
      {traitDetail && <RuleText text={traitDetail.text} />}
    </Modal>
    <Modal
      open={Boolean(incidentDetail)}
      onClose={() => setIncidentDetail(null)}
      title={incidentDetail ? `Инцидент: ${incidentDetail.title}` : "Инцидент"}
      footer={
        <>
          <span className="grow" />
          <Button variant="primary" onClick={() => setIncidentDetail(null)}>
            Закрыть
          </Button>
        </>
      }
    >
      {incidentDetail && <p>{incidentDetail.text}</p>}
    </Modal>
    <Modal
      open={Boolean(subclassDetail)}
      onClose={() => setSubclassDetail(null)}
      title={subclassDetail ? subclassDetail.title : "Подкласс"}
      footer={
        <>
          <span className="grow" />
          <Button variant="primary" onClick={() => setSubclassDetail(null)}>
            Закрыть
          </Button>
        </>
      }
    >
      {subclassDetail && <RuleText text={subclassDetail.text} />}
    </Modal>
    <Modal
      open={Boolean(abilityDetail)}
      onClose={() => setAbilityDetail(null)}
      title="Способность"
      wide
      footer={
        <>
          <span className="grow" />
          <Button variant="primary" onClick={() => setAbilityDetail(null)}>
            Закрыть
          </Button>
        </>
      }
    >
      {abilityDetail && (
        <AbilityCard ability={abilityDetail} character={hero} full flat />
      )}
    </Modal>
    </>
  );
}
