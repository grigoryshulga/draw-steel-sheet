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
  const state = montageState(scene);
  const heroes = members.flatMap(m => m.role === "player" && m.hero ? [{ id: m.hero.id, name: m.hero.name }] : []);
  const finished = !!state.result;
  const disabled = busy || finished;
  const resultText = state.result && state.outcomes?.[state.result];
  const victories = state.result ? montageVictories(state.result, state.difficulty) : undefined;

  return <div className="scene-challenge">
    <div className="scene-challenge-status" role="status">
      <strong>{state.result ? montageResults[state.result] : `Раунд ${scene.round} / ${state.rounds}`}</strong>
      {director && victories !== undefined && <span>Победы за монтаж · {victories}</span>}
      {director && resultText && <span className="scene-challenge-note">{resultText}</span>}
    </div>
    {director && <>
      {!finished && <div className="scene-challenge-actions">
        <Button size="sm" disabled={disabled} onClick={() => onChange(recordMontage(scene, "successes"))}>Успех +1</Button>
        <Button size="sm" disabled={disabled} onClick={() => onChange(recordMontage(scene, "failures"))}>Провал +1</Button>
        <Button size="sm" variant="soft" disabled={disabled} onClick={() => onChange(advanceMontage(scene))}>
          {scene.round >= state.rounds ? "Завершить монтаж" : "Следующий раунд"}
        </Button>
      </div>}
      {heroes.length > 0 && !finished && (
        <div className="scene-challenge-roster" aria-label="Вклад героев в раунде">
          {heroes.map(hero => {
            const acted = state.acted?.includes(hero.id);
            return <div className="scene-challenge-row" key={hero.id}>
              <span>{hero.name}</span>
              <div className="scene-challenge-actions">
                {acted ? <span className="scene-challenge-done">Готово</span> :
                  <>{([
                    ["successes", "Успех"], ["failures", "Провал"], ["pass", "Помощь или пропуск"],
                  ] as const).map(([result, name]) => <Button key={result} size="sm"
                    disabled={disabled} aria-label={`${name}: ${hero.name}`}
                    onClick={() => onChange(recordMontage(scene, result, hero.id))}>
                    {result === "pass" ? "Помощь / пропуск" : name}
                  </Button>)}</>}
              </div>
            </div>;
          })}
        </div>
      )}
      <details className="scene-challenge-details scene-challenge-options">
        <summary>Дополнительно</summary>
        {state.obstacles && <p className="scene-challenge-note">{state.obstacles}</p>}
        <p className="muted">Герой действует один раз за раунд. Один и тот же навык герой обычно использует один раз за весь монтаж.</p>
        <div className="scene-challenge-actions">
          <Button size="sm" disabled={disabled} onClick={() => onChange(recordMontage(scene, "successes", undefined, 2))}>Автоматический успех +2</Button>
          {state.result && <Button size="sm" disabled={busy}
            onClick={() => onChange({ ...scene, challenge: { ...state, result: undefined } })}>Снять итог</Button>}
        </div>
        {corrections}
      </details>
    </>}
  </div>;
}

function NegotiationControls({ scene, director, busy, onChange, corrections }: Omit<Props, "members">) {
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
      const label = trait?.kind === "pitfall" ? "Применить" : trait?.used ? "Повтор" :
        tier === "critical" ? "19–20" : ["", "I", "II", "III"][tier];
      const signed = (n: number) => n > 0 ? `+${n}` : String(n);
      return <Button key={tier} size="sm" disabled={disabled}
        aria-label={`${trait?.name ?? "Обычный аргумент"} · ${label}`}
        title={`Интерес ${signed(effect.interest)} · терпение ${signed(effect.patience)}`}
        onClick={() => { setResearchHint(false); onChange(negotiationArgument(scene, tier, trait?.id)); }}>
        {label}
      </Button>;
    });
  };
  const status = state.result ? state.result === "accepted" ? "Сделка заключена" : "Переговоры завершены" :
    progressVisible && terminal ? noDeal ? "Сделки нет" : "Окончательное предложение" : undefined;

  return <div className="scene-challenge">
    {(state.npc || status || director) && <div className="scene-challenge-status" role="status">
      {state.npc && <strong>{state.npc}</strong>}
      {status && <span>{status}</span>}
      {director && <span>{negotiationOffers[interest]}{state.offers?.[interest] && ` · ${state.offers[interest]}`}</span>}
    </div>}
    {director ? <>
      {!state.result && !terminal && <div className="scene-challenge-roster" aria-label="Аргументы">
        <div className="scene-challenge-row">
          <span>Обычный аргумент</span>
          <div className="scene-challenge-actions">{tiers()}</div>
        </div>
        {traits.map(trait => <div className="scene-challenge-row" key={trait.id}>
          <span>{trait.name}<small>{trait.kind === "pitfall" ? "Опасная тема" : trait.used ? "Мотивация · использована" : "Мотивация"}</small></span>
          <div className="scene-challenge-actions">
            {tiers(trait)}
            <Button size="sm" icon={trait.revealed ? "eye-off" : "eye"} iconOnly variant="ghost" disabled={busy}
              onClick={() => {
                setResearchHint(false);
                onChange({ ...scene, challenge: { ...state, traits: state.traits.map(t => t.id === trait.id ? { ...t, revealed: !t.revealed } : t) } });
              }}>
              {`${trait.revealed ? "Скрыть" : "Раскрыть"}: ${trait.name}`}
            </Button>
          </div>
        </div>)}
      </div>}
      {!state.result && <div className="scene-challenge-actions">
        {interest >= 2 && <Button size="sm" disabled={busy} variant="soft" onClick={() => finish("accepted")}>Принять предложение</Button>}
        <Button size="sm" disabled={busy} onClick={() => finish("declined")}>
          {noDeal ? "Завершить переговоры" : "Уйти без сделки"}
        </Button>
      </div>}
      <details className="scene-challenge-details scene-challenge-options">
        <summary>Дополнительно</summary>
        {state.impression !== undefined && <p>Впечатление · {state.impression}</p>}
        <div className="scene-challenge-actions">
          <span>Распознать мотивацию или тему</span>
          {([1, 2, 3] as const).map(tier => <Button key={tier} size="sm"
            disabled={disabled || state.researched} aria-label={`Распознавание · тир ${tier}`}
            onClick={() => { setResearchHint(tier === 3); onChange(researchNegotiation(scene, tier)); }}>
            {["", "I", "II", "III"][tier]}
          </Button>)}
        </div>
        {researchHint && <p role="status">Раскройте одну мотивацию или опасную тему по выбору героя.</p>}
        <div className="scene-challenge-actions">
          <Button size="sm" disabled={disabled} onClick={() => onChange(negotiationArgument(scene, 1))}>Повтор обычного аргумента</Button>
          <Button size="sm" disabled={busy || !!state.result || noDeal} title="Если неудачный аргумент раскрыл ложь"
            onClick={() => onChange(setChallengeCounter(scene, "interest", { value: interest - 1 }))}>Пойман на лжи −1</Button>
          {state.result && <Button size="sm" disabled={busy}
            onClick={() => onChange({ ...scene, challenge: { ...state, result: undefined } })}>Снять итог</Button>}
        </div>
        {corrections}
      </details>
    </> : traits.some(t => t.revealed) && <div className="scene-challenge-actions">
      {traits.filter(t => t.revealed).map(t => <span className="table-badge" key={t.id}>
        {t.kind === "pitfall" ? "Опасная тема" : "Мотивация"} · {t.name}
      </span>)}
    </div>}
  </div>;
}
