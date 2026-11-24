import { useLocale } from "../../i18n/locale";
import { useState, type ReactNode } from "react";
import { Button } from "../../components/ui";
import {
  advanceMontage, argumentEffect, montageResults, montageState, montageVictories, negotiationArgument,
  negotiationOffers, negotiationProgress, negotiationState, recordMontage, rememberNegotiationStart,
  researchNegotiation, setChallengeCounter, type ArgumentTier,
} from "../../lib/tables/challenges";
import type { NegotiationTrait, TableMember, TableScene } from "../../lib/tables/types";

export function SceneChallengeControls({ scene, members, director, busy, onChange, corrections }: {
  scene: TableScene;
  members: TableMember[];
  director: boolean;
  busy: boolean;
  onChange: (scene: TableScene) => void;
  corrections: ReactNode;
}) {
  if (scene.kind === "montage") return <MontageControls {...{ scene, members, director, busy, onChange, corrections }} />;
  if (scene.kind === "negotiation") return <NegotiationControls {...{ scene, director, busy, onChange, corrections }} />;
  return null;
}
type Props = Parameters<typeof SceneChallengeControls>[0];

function MontageControls({ scene, members, director, busy, onChange, corrections }: Props) {
  const { t: tr } = useLocale();
  const state = montageState(scene);
  const heroes = members.flatMap(m => m.role === "player" && m.hero ? [{ id: m.hero.id, name: m.hero.name }] : []);
  const finished = !!state.result;
  const disabled = busy || finished;
  const resultText = state.result && state.outcomes?.[state.result];
  const victories = state.result ? montageVictories(state.result, state.difficulty) : undefined;

  return <div className="scene-challenge">
    <div className="scene-challenge-status" role="status">
      <strong>{state.result ? tr(montageResults[state.result], ({ success: "Complete success", partial: "Partial success", failure: "Complete failure" })[state.result]) : `${tr("Раунд", "Round")} ${scene.round} / ${state.rounds}`}</strong>
      {director && victories !== undefined && <span>{tr("Победы за монтаж", "Montage victories")} · {victories}</span>}
      {director && resultText && <span className="scene-challenge-note">{resultText}</span>}
    </div>
    {director && <>
      {!finished && <div className="scene-challenge-actions">
        <Button size="sm" disabled={disabled} onClick={() => onChange(recordMontage(scene, "successes"))}>{tr("Успех +1", "Success +1")}</Button>
        <Button size="sm" disabled={disabled} onClick={() => onChange(recordMontage(scene, "failures"))}>{tr("Провал +1", "Failure +1")}</Button>
        <Button size="sm" variant="soft" disabled={disabled} onClick={() => onChange(advanceMontage(scene))}>
          {scene.round >= state.rounds ? tr("Завершить монтаж", "Finish montage") : tr("Следующий раунд", "Next round")}
        </Button>
      </div>}
      {heroes.length > 0 && !finished && (
        <div className="scene-challenge-roster" aria-label={tr("Вклад героев в раунде", "Hero contributions this round")}>
          {heroes.map(hero => {
            const acted = state.acted?.includes(hero.id);
            return <div className="scene-challenge-row" key={hero.id}>
              <span>{hero.name}</span>
              <div className="scene-challenge-actions">
                {acted ? <span className="scene-challenge-done">{tr("Готово", "Done")}</span> :
                  <>{([
                    ["successes", tr("Успех", "Success")], ["failures", tr("Провал", "Failure")], ["pass", tr("Помощь или пропуск", "Assist or pass")],
                  ] as const).map(([result, name]) => <Button key={result} size="sm"
                    disabled={disabled} aria-label={`${name}: ${hero.name}`}
                    onClick={() => onChange(recordMontage(scene, result, hero.id))}>
                    {result === "pass" ? tr("Помощь / пропуск", "Assist / pass") : name}
                  </Button>)}</>}
              </div>
            </div>;
          })}
        </div>
      )}
      <details className="scene-challenge-details scene-challenge-options">
        <summary>{tr("Дополнительно", "More options")}</summary>
        {state.obstacles && <p className="scene-challenge-note">{state.obstacles}</p>}
        <p className="muted">{tr("Герой действует один раз за раунд. Один и тот же навык герой обычно использует один раз за весь монтаж.", "A hero acts once per round and usually uses a skill only once per montage.")}</p>
        <div className="scene-challenge-actions">
          <Button size="sm" disabled={disabled} onClick={() => onChange(recordMontage(scene, "successes", undefined, 2))}>{tr("Автоматический успех +2", "Automatic success +2")}</Button>
          {state.result && <Button size="sm" disabled={busy}
            onClick={() => onChange({ ...scene, challenge: { ...state, result: undefined } })}>{tr("Снять итог", "Clear outcome")}</Button>}
        </div>
        {corrections}
      </details>
    </>}
  </div>;
}

function NegotiationControls({ scene, director, busy, onChange, corrections }: Omit<Props, "members">) {
  const { t: tr } = useLocale();
  const [researchHint, setResearchHint] = useState(false);
  const state = negotiationState(scene);
  const { interest, terminal } = negotiationProgress(scene);
  const noDeal = interest === 0;
  const disabled = busy || terminal || !!state.result;
  const progressVisible = director || (scene.counters.some(c => c.public && (c.id === "interest" || c.name === "Интерес")) &&
    scene.counters.some(c => c.public && (c.id === "patience" || c.name === "Терпение")));
  const traits = state.traits.filter(t => t.name.trim());
  const finish = (result: "accepted" | "declined") =>
    onChange({ ...scene, challenge: { ...rememberNegotiationStart(scene), result } });
  const tiers = (trait?: NegotiationTrait) => {
    const values: ArgumentTier[] = trait?.kind === "pitfall" || trait?.used ? [1] : trait ? [1, 2, 3] : [1, 2, 3, "critical"];
    return values.map(tier => {
      const effect = argumentEffect(tier, trait);
      const label = trait?.kind === "pitfall" ? tr("Применить", "Apply") : trait?.used ? tr("Повтор", "Repeat") :
        tier === "critical" ? "19–20" : ["", "I", "II", "III"][tier];
      const signed = (n: number) => n > 0 ? `+${n}` : String(n);
      return <Button key={tier} size="sm" disabled={disabled}
        aria-label={`${trait?.name ?? tr("Обычный аргумент", "Ordinary argument")} · ${label}`}
        title={`${tr("Интерес", "Interest")} ${signed(effect.interest)} · ${tr("терпение", "patience")} ${signed(effect.patience)}`}
        onClick={() => { setResearchHint(false); onChange(negotiationArgument(scene, tier, trait?.id)); }}>
        {label}
      </Button>;
    });
  };
  const status = state.result ? state.result === "accepted" ? tr("Сделка заключена", "Deal reached") : tr("Переговоры завершены", "Negotiation ended") :
    progressVisible && terminal ? noDeal ? tr("Сделки нет", "No deal") : tr("Окончательное предложение", "Final offer") : undefined;

  return <div className="scene-challenge">
    {(state.npc || status || director) && <div className="scene-challenge-status" role="status">
      {state.npc && <strong>{state.npc}</strong>}
      {status && <span>{status}</span>}
      {director && <span>{tr(negotiationOffers[interest], ["No, and…", "No", "No, but…", "Yes, but…", "Yes", "Yes, and…"][interest] ?? negotiationOffers[interest])}{state.offers?.[interest] && ` · ${state.offers[interest]}`}</span>}
    </div>}
    {director ? <>
      {!state.result && !terminal && <div className="scene-challenge-roster" aria-label={tr("Аргументы", "Arguments")}>
        <div className="scene-challenge-row">
          <span>{tr("Обычный аргумент", "Ordinary argument")}</span>
          <div className="scene-challenge-actions">{tiers()}</div>
        </div>
        {traits.map(trait => <div className="scene-challenge-row" key={trait.id}>
          <span>{trait.name}<small>{trait.kind === "pitfall" ? tr("Опасная тема", "Pitfall") : trait.used ? tr("Мотивация · использована", "Motivation · used") : tr("Мотивация", "Motivation")}</small></span>
          <div className="scene-challenge-actions">
            {tiers(trait)}
            <Button size="sm" icon={trait.revealed ? "eye-off" : "eye"} iconOnly variant="ghost" disabled={busy}
              onClick={() => {
                setResearchHint(false);
                onChange({ ...scene, challenge: { ...state, traits: state.traits.map(t => t.id === trait.id ? { ...t, revealed: !t.revealed } : t) } });
              }}>
              {`${trait.revealed ? tr("Скрыть", "Hide") : tr("Раскрыть", "Reveal")}: ${trait.name}`}
            </Button>
          </div>
        </div>)}
      </div>}
      {!state.result && <div className="scene-challenge-actions">
        {interest >= 2 && <Button size="sm" disabled={busy} variant="soft" onClick={() => finish("accepted")}>{tr("Принять предложение", "Accept offer")}</Button>}
        <Button size="sm" disabled={busy} onClick={() => finish("declined")}>
          {noDeal ? tr("Завершить переговоры", "End negotiation") : tr("Уйти без сделки", "Leave without a deal")}
        </Button>
      </div>}
      <details className="scene-challenge-details scene-challenge-options">
        <summary>{tr("Дополнительно", "More options")}</summary>
        {state.impression !== undefined && <p>{tr("Впечатление", "Impression")} · {state.impression}</p>}
        <div className="scene-challenge-actions">
          <span>{tr("Распознать мотивацию или тему", "Discover motivation or pitfall")}</span>
          {([1, 2, 3] as const).map(tier => <Button key={tier} size="sm"
            disabled={disabled || state.researched} aria-label={`${tr("Распознавание · тир", "Discovery · tier")} ${tier}`}
            onClick={() => { setResearchHint(tier === 3); onChange(researchNegotiation(scene, tier)); }}>
            {["", "I", "II", "III"][tier]}
          </Button>)}
        </div>
        {researchHint && <p role="status">{tr("Раскройте одну мотивацию или опасную тему по выбору героя.", "Reveal one motivation or pitfall chosen by the hero.")}</p>}
        <div className="scene-challenge-actions">
          <Button size="sm" disabled={disabled} onClick={() => onChange(negotiationArgument(scene, 1))}>{tr("Повтор обычного аргумента", "Repeat ordinary argument")}</Button>
          <Button size="sm" disabled={busy || !!state.result || noDeal} title={tr("Если неудачный аргумент раскрыл ложь", "If a failed argument revealed a lie")}
            onClick={() => onChange(setChallengeCounter(scene, "interest", { value: interest - 1 }))}>{tr("Пойман на лжи −1", "Caught lying −1")}</Button>
          {state.result && <Button size="sm" disabled={busy}
            onClick={() => onChange({ ...scene, challenge: { ...state, result: undefined } })}>{tr("Снять итог", "Clear outcome")}</Button>}
        </div>
        {corrections}
      </details>
    </> : traits.some(t => t.revealed) && <div className="scene-challenge-actions">
      {traits.filter(t => t.revealed).map(t => <span className="table-badge" key={t.id}>
        {t.kind === "pitfall" ? tr("Опасная тема", "Pitfall") : tr("Мотивация", "Motivation")} · {t.name}
      </span>)}
    </div>}
  </div>;
}
