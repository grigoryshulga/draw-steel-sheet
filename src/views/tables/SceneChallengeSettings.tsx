import { useLocale } from "../../i18n/locale";
import { useId } from "react";
import { Button, Select } from "../../components/ui";
import {
  challengeCounter, montageDifficulties, montageLimits, montageResults, montageState,
  negotiationAttitudes, negotiationOffers, negotiationState, setChallengeCounter,
} from "../../lib/tables/challenges";
import { sceneId } from "../../lib/tables/scenes";
import type { MontageDifficulty, NegotiationTrait, TableScene } from "../../lib/tables/types";

const motives = ["Благожелательность", "Власть", "Высший авторитет", "Жадность", "Защита", "Кутеж",
  "Месть", "Наследие", "Открытия", "Покой", "Свобода", "Справедливость"];
const asInteger = (value: number, min: number, max: number) => Math.min(max, Math.max(min, Math.trunc(value) || 0));

export function SceneChallengeSettings({ scene, heroes, onChange }: {
  scene: TableScene;
  heroes: number;
  onChange: (scene: TableScene) => void;
}) {
  const { t: tr } = useLocale();
  const listId = useId();
  if (scene.kind === "montage") {
    const state = montageState(scene);
    const limits = (key: "successes" | "failures") => (
      <label key={key}>
        {key === "successes" ? tr("Предел успехов", "Success limit") : tr("Предел провалов", "Failure limit")}
        <input className="input" type="number" min={2} max={99}
          value={challengeCounter(scene, key)?.max ?? (key === "successes" ? 6 : 4)}
          onChange={e => onChange(setChallengeCounter(scene, key, { max: asInteger(e.target.valueAsNumber, 2, 99) }))} />
      </label>
    );
    return <section className="scene-challenge-settings">
      <h3>{tr("Монтаж-тест", "Montage test")}</h3>
      <div className="scene-grid">
        <label>
          {tr("Сложность", "Difficulty")}
          <Select value={state.difficulty ?? ""} onChange={e => {
            const difficulty = (e.target.value || undefined) as MontageDifficulty | undefined;
            const next = { ...scene, challenge: { ...state, difficulty } };
            if (!difficulty) { onChange(next); return; }
            const recommended = montageLimits(difficulty, heroes);
            onChange(setChallengeCounter(setChallengeCounter(next, "successes", { max: recommended.successes }), "failures", { max: recommended.failures }));
          }}>
            <option value="">{tr("Свои пределы", "Custom limits")}</option>
            {Object.entries(montageDifficulties).map(([value, label]) => <option key={value} value={value}>{tr(label, ({ easy: "Easy", moderate: "Moderate", hard: "Hard" } as Record<string, string>)[value] ?? label)}</option>)}
          </Select>
        </label>
        {limits("successes")}
        {limits("failures")}
      </div>
      <details className="table-disclosure scene-challenge-details">
        <summary>{tr("Раунды, препятствия и итоги", "Rounds, obstacles and outcomes")}</summary>
        <div className="scene-grid">
          <label>
            {tr("Число раундов", "Number of rounds")}
            <input className="input" type="number" min={1} max={99} value={state.rounds}
              onChange={e => onChange({ ...scene, challenge: { ...state, rounds: asInteger(e.target.valueAsNumber, 1, 99) } })} />
          </label>
          <label className="table-check">
            <input type="checkbox" checked={!!state.hideLimits}
              onChange={e => onChange({ ...scene, challenge: { ...state, hideLimits: e.target.checked } })} /> {tr("Скрыть пределы от игроков", "Hide limits from players")}
          </label>
        </div>
        <label>{tr("Препятствия", "Obstacles")}
          <textarea className="textarea" maxLength={10000} value={state.obstacles ?? ""}
            onChange={e => onChange({ ...scene, challenge: { ...state, obstacles: e.target.value } })} />
        </label>
        {Object.entries(montageResults).map(([key, label]) => {
          const outcome = key as keyof typeof montageResults;
          return <label key={key}>{tr(label, ({ success: "Complete success", partial: "Partial success", failure: "Complete failure" } as Record<string, string>)[key] ?? label)}
            <textarea className="textarea" maxLength={10000} value={state.outcomes?.[outcome] ?? ""}
              onChange={e => onChange({ ...scene, challenge: { ...state, outcomes: { ...state.outcomes, [outcome]: e.target.value } } })} />
          </label>;
        })}
      </details>
    </section>;
  }

  if (scene.kind !== "negotiation") return null;
  const state = negotiationState(scene);
  const score = (key: "interest" | "patience", label: string, fallback: number) => {
    const counter = challengeCounter(scene, key);
    return <div key={key} className="scene-challenge-score-setting">
      <label>{label}
        <input type="number" className="input" min={scene.status === "prepared" ? 1 : 0}
          max={scene.status === "prepared" && key === "interest" ? 4 : 5} value={counter?.value ?? fallback}
          onChange={e => {
            const value = asInteger(e.target.valueAsNumber, scene.status === "prepared" ? 1 : 0,
              scene.status === "prepared" && key === "interest" ? 4 : 5);
            const initial = key === "interest" ? { initialInterest: value } : { initialPatience: value };
            onChange(setChallengeCounter({ ...scene, challenge: scene.status === "prepared" ? { ...state, ...initial } : state }, key, { value }));
          }} />
      </label>
      <label className="table-check">
        <input type="checkbox" checked={counter?.public ?? false}
          onChange={e => onChange(setChallengeCounter(scene, key, { public: e.target.checked }))} /> {tr("Видно игрокам", "Visible to players")}
      </label>
    </div>;
  };
  const changeTrait = (id: string, patch: Partial<NegotiationTrait>) =>
    onChange({ ...scene, challenge: { ...state, traits: state.traits.map(t => t.id === id ? { ...t, ...patch } : t) } });
  return <section className="scene-challenge-settings">
    <h3>{tr("Переговоры", "Negotiation")}</h3>
    <div className="scene-grid">
      <label>{tr("Собеседник", "Negotiator")}
        <input className="input" maxLength={200} value={state.npc ?? ""}
          onChange={e => onChange({ ...scene, challenge: { ...state, npc: e.target.value } })} />
      </label>
      <label>{tr("Применить начальное отношение", "Apply starting attitude")}
        <Select value="" onChange={e => {
          const attitude = negotiationAttitudes[Number(e.target.value)];
          if (!attitude) return;
          const next = { ...scene, challenge: { ...state, initialInterest: attitude.interest, initialPatience: attitude.patience } };
          onChange(setChallengeCounter(setChallengeCounter(next, "interest", { value: attitude.interest }), "patience", { value: attitude.patience }));
        }}>
          <option value="">{tr("Выбрать отношение", "Choose attitude")}</option>
          {negotiationAttitudes.map((a, i) => <option key={a.label} value={i}>{tr(a.label, ["Hostile", "Suspicious", "Neutral", "Open", "Friendly", "Trusting"][i])} · {a.interest}/{a.patience}</option>)}
        </Select>
      </label>
      {score("interest", tr("Интерес", "Interest"), 2)}
      {score("patience", tr("Терпение", "Patience"), 3)}
    </div>
    <datalist id={listId}>{motives.map(name => <option key={name} value={name} />)}</datalist>
    {(["motivation", "pitfall"] as const).map(kind => (
      <div key={kind} className="scene-challenge-settings">
        <h4>{kind === "motivation" ? tr("Мотивации", "Motivations") : tr("Опасные темы", "Pitfalls")}</h4>
        {state.traits.filter(t => t.kind === kind).map(t => <div className="scene-challenge-trait-input" key={t.id}>
          <input className="input" list={listId} maxLength={200} value={t.name}
            aria-label={kind === "motivation" ? tr("Мотивация", "Motivation") : tr("Опасная тема", "Pitfall")}
            onChange={e => changeTrait(t.id, { name: e.target.value })} />
          <Button iconOnly icon="trash" size="sm" variant="ghost"
            onClick={() => onChange({ ...scene, challenge: { ...state, traits: state.traits.filter(item => item.id !== t.id) } })}>{tr("Удалить", "Delete")}</Button>
        </div>)}
        <div><Button icon="plus" size="sm" disabled={state.traits.length >= 50}
          onClick={() => onChange({ ...scene, challenge: { ...state, traits: [...state.traits, { id: sceneId(), name: "", kind, revealed: false }] } })}>
          {kind === "motivation" ? tr("Добавить мотивацию", "Add motivation") : tr("Добавить опасную тему", "Add pitfall")}
        </Button></div>
      </div>
    ))}
    <details className="table-disclosure scene-challenge-details">
      <summary>{tr("Предложения, слава и язык", "Offers, renown and language")}</summary>
      <label>{tr("Впечатление", "Impression")}
        <input className="input" type="number" min={0} max={1000000000} value={state.impression ?? ""}
          onChange={e => onChange({ ...scene, challenge: { ...state, impression: e.target.value === "" ? undefined : asInteger(e.target.valueAsNumber, 0, 1000000000) } })} />
      </label>
      <p className="muted">{tr("Родной язык НПС, кроме каэлийского, добавляет 1 к начальному терпению. Если на нём говорят от трёх героев, добавьте 2. Предел остаётся 5.", "The NPC’s native language, other than Caelian, adds 1 starting patience. If three or more heroes speak it, add 2. The maximum remains 5.")}</p>
      {negotiationOffers.map((label, i) => <label key={label}>{i} · {tr(label, ["No, and…", "No", "No, but…", "Yes, but…", "Yes", "Yes, and…"][i])}
        <textarea className="textarea" maxLength={10000} value={state.offers?.[i] ?? ""}
          onChange={e => onChange({ ...scene, challenge: { ...state,
            offers: negotiationOffers.map((_, j) => j === i ? e.target.value : state.offers?.[j] ?? "") } })} />
      </label>)}
    </details>
  </section>;
}
