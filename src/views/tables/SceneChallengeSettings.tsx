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
  const listId = useId();
  if (scene.kind === "montage") {
    const state = montageState(scene);
    const limits = (key: "successes" | "failures") => (
      <label key={key}>
        {key === "successes" ? "Предел успехов" : "Предел провалов"}
        <input className="input" type="number" min={2} max={99}
          value={challengeCounter(scene, key)?.max ?? (key === "successes" ? 6 : 4)}
          onChange={e => onChange(setChallengeCounter(scene, key, { max: asInteger(e.target.valueAsNumber, 2, 99) }))} />
      </label>
    );
    return <section className="scene-challenge-settings">
      <h3>Монтаж-тест</h3>
      <div className="scene-grid">
        <label>
          Сложность
          <Select value={state.difficulty ?? ""} onChange={e => {
            const difficulty = (e.target.value || undefined) as MontageDifficulty | undefined;
            const next = { ...scene, challenge: { ...state, difficulty } };
            if (!difficulty) { onChange(next); return; }
            const recommended = montageLimits(difficulty, heroes);
            onChange(setChallengeCounter(setChallengeCounter(next, "successes", { max: recommended.successes }), "failures", { max: recommended.failures }));
          }}>
            <option value="">Свои пределы</option>
            {Object.entries(montageDifficulties).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </Select>
        </label>
        {limits("successes")}
        {limits("failures")}
      </div>
      <details className="table-disclosure scene-challenge-details">
        <summary>Раунды, препятствия и итоги</summary>
        <div className="scene-grid">
          <label>
            Число раундов
            <input className="input" type="number" min={1} max={99} value={state.rounds}
              onChange={e => onChange({ ...scene, challenge: { ...state, rounds: asInteger(e.target.valueAsNumber, 1, 99) } })} />
          </label>
          <label className="table-check">
            <input type="checkbox" checked={!!state.hideLimits}
              onChange={e => onChange({ ...scene, challenge: { ...state, hideLimits: e.target.checked } })} /> Скрыть пределы от игроков
          </label>
        </div>
        <label>Препятствия
          <textarea className="textarea" maxLength={10000} value={state.obstacles ?? ""}
            onChange={e => onChange({ ...scene, challenge: { ...state, obstacles: e.target.value } })} />
        </label>
        {Object.entries(montageResults).map(([key, label]) => {
          const outcome = key as keyof typeof montageResults;
          return <label key={key}>{label}
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
          onChange={e => onChange(setChallengeCounter(scene, key, { public: e.target.checked }))} /> Видно игрокам
      </label>
    </div>;
  };
  const changeTrait = (id: string, patch: Partial<NegotiationTrait>) =>
    onChange({ ...scene, challenge: { ...state, traits: state.traits.map(t => t.id === id ? { ...t, ...patch } : t) } });
  return <section className="scene-challenge-settings">
    <h3>Переговоры</h3>
    <div className="scene-grid">
      <label>Собеседник
        <input className="input" maxLength={200} value={state.npc ?? ""}
          onChange={e => onChange({ ...scene, challenge: { ...state, npc: e.target.value } })} />
      </label>
      <label>Применить начальное отношение
        <Select value="" onChange={e => {
          const attitude = negotiationAttitudes[Number(e.target.value)];
          if (!attitude) return;
          const next = { ...scene, challenge: { ...state, initialInterest: attitude.interest, initialPatience: attitude.patience } };
          onChange(setChallengeCounter(setChallengeCounter(next, "interest", { value: attitude.interest }), "patience", { value: attitude.patience }));
        }}>
          <option value="">Выбрать отношение</option>
          {negotiationAttitudes.map((a, i) => <option key={a.label} value={i}>{a.label} · {a.interest}/{a.patience}</option>)}
        </Select>
      </label>
      {score("interest", "Интерес", 2)}
      {score("patience", "Терпение", 3)}
    </div>
    <datalist id={listId}>{motives.map(name => <option key={name} value={name} />)}</datalist>
    {(["motivation", "pitfall"] as const).map(kind => (
      <div key={kind} className="scene-challenge-settings">
        <h4>{kind === "motivation" ? "Мотивации" : "Опасные темы"}</h4>
        {state.traits.filter(t => t.kind === kind).map(t => <div className="scene-challenge-trait-input" key={t.id}>
          <input className="input" list={listId} maxLength={200} value={t.name}
            aria-label={kind === "motivation" ? "Мотивация" : "Опасная тема"}
            onChange={e => changeTrait(t.id, { name: e.target.value })} />
          <Button iconOnly icon="trash" size="sm" variant="ghost"
            onClick={() => onChange({ ...scene, challenge: { ...state, traits: state.traits.filter(item => item.id !== t.id) } })}>Удалить</Button>
        </div>)}
        <div><Button icon="plus" size="sm" disabled={state.traits.length >= 50}
          onClick={() => onChange({ ...scene, challenge: { ...state, traits: [...state.traits, { id: sceneId(), name: "", kind, revealed: false }] } })}>
          {kind === "motivation" ? "Добавить мотивацию" : "Добавить опасную тему"}
        </Button></div>
      </div>
    ))}
    <details className="table-disclosure scene-challenge-details">
      <summary>Предложения, слава и язык</summary>
      <label>Впечатление
        <input className="input" type="number" min={0} max={1000000000} value={state.impression ?? ""}
          onChange={e => onChange({ ...scene, challenge: { ...state, impression: e.target.value === "" ? undefined : asInteger(e.target.valueAsNumber, 0, 1000000000) } })} />
      </label>
      <p className="muted">Родной язык НПС, кроме каэлийского, добавляет 1 к начальному терпению. Если на нём говорят от трёх героев, добавьте 2. Предел остаётся 5.</p>
      {negotiationOffers.map((label, i) => <label key={label}>{i} · {label}
        <textarea className="textarea" maxLength={10000} value={state.offers?.[i] ?? ""}
          onChange={e => onChange({ ...scene, challenge: { ...state,
            offers: negotiationOffers.map((_, j) => j === i ? e.target.value : state.offers?.[j] ?? "") } })} />
      </label>)}
    </details>
  </section>;
}
