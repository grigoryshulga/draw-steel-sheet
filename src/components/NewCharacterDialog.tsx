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
  BUILDER_STEP_V2_KEY,
  LEGACY_BUILDER_STEP_V1_KEY,
  type BuilderStepId,
} from "../lib/builder-steps";
import {
  BUILDER_FLOW_KEY,
  BUILDER_STAGES,
  builderFlow,
  advanceBuilderFlow,
  restoreBuilderFlow,
} from "../lib/builder-flow";
import {
  BUILDER_DRAFT_KEY,
  readBuilderDraft,
  scopedStorageKey,
} from "../lib/builder-draft";
import { createCharacter } from "../lib/defaults";
import { deriveStats } from "../lib/rules";
import type { Ability, Character, Perk } from "../types";
import { useStorageScope } from "../state/StorageScope";
import { Button, Select } from "./ui";
import { CardDetailModal } from "./CardDetailModal";
import { RuleText } from "./RuleText";
import { AbilityCard } from "./AbilityCard";
import { PerkDetailModal } from "./PerkDetailModal";
import { BuilderRuleLinks } from "./builder/BuilderRuleLinks";
import { BuilderPreview } from "./builder/BuilderPreview";
import {
  BuilderStepProvider,
  type BuilderStepContextValue,
} from "./builder/BuilderStepContext";
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
import "./builder/BuilderFlow.css";

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
  const flowKey = scopedStorageKey(BUILDER_FLOW_KEY, scope);
  const [flowId, setFlowId] = useState(() => {
    try {
      return restoreBuilderFlow(
        draft,
        localStorage.getItem(flowKey),
        localStorage.getItem(stepKey),
        localStorage.getItem(legacyStepKey),
      );
    } catch {
      return "ancestry";
    }
  });
  const flow = useMemo(() => builderFlow(draft), [draft]);
  const active =
    flow.find((item) => item.id === flowId) ??
    flow.find((item) => item.step === flowId.split("/")[0]) ??
    flow[0];
  const step = active.step;
  const part = active.part;
  const position = flow.indexOf(active);
  const [pending, setPending] = useState<{
    changes: Partial<BuilderDraft>;
    issue: string;
  } | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showIssues, setShowIssues] = useState(false);
  const [perkDetail, setPerkDetail] = useState<Perk | null>(null);
  const [traitDetail, setTraitDetail] = useState<{
    name: string;
    text: string;
  } | null>(null);
  const [incidentDetail, setIncidentDetail] = useState<{
    title: string;
    text: string;
  } | null>(null);
  const [abilityDetail, setAbilityDetail] = useState<Ability | null>(null);
  const seed = useRef(createCharacter());
  const headingRef = useRef<HTMLHeadingElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const hero = useMemo(() => buildCharacter(draft, seed.current), [draft]);
  const derived = deriveStats(hero);
  const patch = (changes: Partial<BuilderDraft>) => {
    setDraft((current) => ({ ...current, ...changes }));
    setError("");
  };
  const skillSlots = builderSkillSlots(draft);
  const ancestrySkills = selectedSkills(
    skillSlots.ancestry,
    draft.ancestrySkills || [],
  );
  const cultureSkills = selectedSkills(
    skillSlots.culture,
    draft.cultureSkills,
    ancestrySkills,
  );
  const careerSkills = selectedSkills(skillSlots.career, draft.careerSkills, [
    ...ancestrySkills,
    ...cultureSkills,
  ]);
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
      localStorage.setItem(flowKey, active.id);
      localStorage.setItem(stepKey, step);
    } catch {
      /* no storage */
    }
    headingRef.current?.focus({ preventScroll: true });
  }, [active.id, flowKey, step, stepKey]);
  const issues = builderStepIssues(draft);
  const goToFlow = (id: string) => {
    setPending(null);
    setFlowId(id);
    setError("");
    setShowIssues(false);
  };
  const go = (next: BuilderStepId) =>
    goToFlow(flow.find((item) => item.step === next)?.id ?? "details");
  const submit = async (blank = false) => {
    const invalid = flow.find((item) => item.issue);
    if (!blank && invalid) {
      goToFlow(invalid.id);
      setShowIssues(true);
      return;
    }
    const remaining = Object.entries(issues).find(([, issue]) => issue);
    if (!blank && remaining) {
      go(remaining[0] as BuilderStepId);
      setError(remaining[1]);
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onCreate(blank ? createCharacter({ name: draft.name }) : hero);
      setDraft(emptyBuilderDraft());
      setFlowId("ancestry");
      seed.current = createCharacter();
      try {
        localStorage.removeItem(draftKey);
        localStorage.removeItem(flowKey);
        localStorage.removeItem(stepKey);
        localStorage.removeItem(legacyStepKey);
      } catch {
        /* no storage */
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось создать героя");
    } finally {
      setBusy(false);
    }
  };
  const advance = () => {
    const next = advanceBuilderFlow(
      draft,
      active.id,
      pending?.changes,
      pending?.issue,
    );
    if (next.issue) {
      setError(next.issue);
      return;
    }
    setDraft(next.draft);
    goToFlow(next.id);
  };
  const stepContext: BuilderStepContextValue = {
    draft,
    pendingChanges: pending?.changes,
    flow,
    goToFlow,
    patch,
    stageChoice: (changes, issue) => {
      setPending({ changes, issue });
      setError("");
    },
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
    openAbility: setAbilityDetail,
  };
  return (
    <BuilderRuleLinks>
      <div className="builder-page-shell">
        <header className="builder-page-head">
          <div className="builder-page-heading">
            <h1 className="builder-page-title">Создание героя</h1>
          </div>
          <div className="builder-page-head-actions">
            <Button
              variant="ghost"
              icon="close"
              iconOnly
              onClick={onClose}
              disabled={busy}
            >
              Продолжить позже
            </Button>
          </div>
        </header>
        <div className="builder-mobile-controls">
          <Select
            aria-label="Этап создания"
            value={active.stage}
            disabled={busy}
            onChange={(e) => {
              const entries = flow.filter(
                (item) => item.stage === Number(e.target.value),
              );
              const target = entries.find((item) => item.issue) ?? entries[0];
              if (target) goToFlow(target.id);
            }}
          >
            {BUILDER_STAGES.map((label, stage) => (
              <option
                key={label}
                value={stage}
                disabled={!flow.some((item) => item.stage === stage)}
              >
                {stage + 1}. {label}
              </option>
            ))}
          </Select>
          <Button variant="ghost" icon="hero" iconOnly aria-label="Предпросмотр героя" onClick={() => setPreviewOpen(true)}>
            Герой
          </Button>
        </div>
        <div className="builder-page-body">
          <nav className="builder-stage-nav" aria-label="Этапы создания героя">
            {BUILDER_STAGES.map((label, stage) => {
              const entries = flow.filter((item) => item.stage === stage);
              const destination =
                entries.find((item) => item.issue) ?? entries[0];
              return (
                <div key={label} className="builder-stage-group">
                  <button
                    type="button"
                    disabled={busy || !destination}
                    aria-current={active.stage === stage ? "step" : undefined}
                    onClick={() => destination && goToFlow(destination.id)}
                  >
                    <span>{stage + 1}</span>
                    {label}
                  </button>
                  {active.stage === stage && entries.length > 1 && (
                    <nav
                      className="builder-substeps"
                      aria-label="Решения текущего этапа"
                    >
                      {flow
                        .filter((item) => item.stage === active.stage)
                        .map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            disabled={busy}
                            aria-current={
                              item.id === active.id ? "step" : undefined
                            }
                            onClick={() => goToFlow(item.id)}
                          >
                            {item.label}
                          </button>
                        ))}
                    </nav>
                  )}
                </div>
              );
            })}
          </nav>

          <div className="builder-content" ref={contentRef}>
            <h2 className="builder-step-title" ref={headingRef} tabIndex={-1}>
              {active.label}
            </h2>
            <fieldset className="builder-step-fields" disabled={busy}>
              <BuilderStepProvider key={active.id} value={stepContext}>
                {step === "ancestry" && <AncestryStep />}
                {step === "ancestry-options" && <AncestryOptionsStep />}
                {step === "culture" && <CultureStep part={part} />}
                {step === "career" && <CareerStep />}
                {step === "career-options" && <CareerOptionsStep part={part} />}
                {step === "class" && <ClassStep />}
                {step === "class-options" && <ClassOptionsStep part={part} />}
                {step === "kit" && <KitStep part={part} />}
                {step === "abilities" && <AbilitiesStep part={part} />}
                {step === "details" && <DetailsStep />}
                {step === "summary" && <SummaryStep />}
              </BuilderStepProvider>
            </fieldset>
            {((showIssues && active.issue) || error) && (
              <p className="builder-error" role="alert">
                {error || active.issue}
              </p>
            )}
          </div>
          <div className="builder-preview-rail">
            <BuilderPreview
              hero={hero}
              derived={derived}
              seedAbilities={seed.current.abilities}
              busy={busy}
              onReset={() => {
                setDraft(emptyBuilderDraft());
                goToFlow("ancestry");
              }}
            />
          </div>
        </div>
        <footer className="builder-page-footer">
          <div className="builder-page-footer-actions">
            {position > 0 && (
              <Button
                onClick={() => goToFlow(flow[position - 1].id)}
                icon="arrow-left"
                iconOnly
                aria-label="Предыдущий шаг"
                disabled={busy}
              >
                Назад
              </Button>
            )}
            <Button
              variant="primary"
              icon={step === "summary" ? undefined : "chevron-right"}
              iconOnly={step !== "summary"}
              aria-label={step === "summary" ? undefined : "Следующий шаг"}
              disabled={busy}
              onClick={() => (step === "summary" ? void submit() : advance())}
            >
              {busy
                ? "Создание…"
                : step === "summary"
                  ? Object.values(issues).some(Boolean) ? "Завершить выборы" : "Создать героя"
                  : "Далее"}
            </Button>
          </div>
        </footer>
      </div>
      <CardDetailModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title="Ваш герой"
      >
        <BuilderPreview
          hero={hero}
          derived={derived}
          seedAbilities={seed.current.abilities}
          busy={busy}
          onReset={() => {
            setDraft(emptyBuilderDraft());
            goToFlow("ancestry");
            setPreviewOpen(false);
          }}
        />
      </CardDetailModal>
      <PerkDetailModal
        open={Boolean(perkDetail)}
        onClose={() => setPerkDetail(null)}
        name={perkDetail?.name ?? ""}
        type={perkDetail?.type}
        summary={perkDetail?.summary}
        description={perkDetail?.description}
      />
      <CardDetailModal
        open={Boolean(traitDetail)}
        onClose={() => setTraitDetail(null)}
        title={traitDetail?.name ?? "Черта"}
        source="Черта"
        autoHeight
      >
        {traitDetail && <RuleText text={traitDetail.text} />}
      </CardDetailModal>
      <CardDetailModal
        open={Boolean(incidentDetail)}
        onClose={() => setIncidentDetail(null)}
        title={incidentDetail?.title ?? "Инцидент"}
        source="Инцидент"
        autoHeight
      >
        {incidentDetail && <p>{incidentDetail.text}</p>}
      </CardDetailModal>
      <CardDetailModal
        open={Boolean(abilityDetail)}
        onClose={() => setAbilityDetail(null)}
        title="Способность"
        wide
      >
        {abilityDetail && (
          <AbilityCard ability={abilityDetail} character={hero} full flat />
        )}
      </CardDetailModal>
    </BuilderRuleLinks>
  );
}
