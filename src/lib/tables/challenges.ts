import type { MontageDifficulty, MontageResult, NegotiationTrait, SceneCounter, TableScene } from "./types";

export const challengeCounterNames = {
  successes: "Успехи", failures: "Провалы", interest: "Интерес", patience: "Терпение",
};
type CounterKey = keyof typeof challengeCounterNames;
export const montageDifficulties = { easy: "Лёгкая", moderate: "Средняя", hard: "Сложная" };
export const montageResults = { success: "Полный успех", partial: "Частичный успех", failure: "Полный провал" };
export const negotiationOffers = ["Нет, и…", "Нет", "Нет, но…", "Да, но…", "Да", "Да, и…"];
export const negotiationAttitudes = [
  { label: "Враждебное", interest: 1, patience: 2 },
  { label: "Подозрительное", interest: 2, patience: 2 },
  { label: "Нейтральное", interest: 2, patience: 3 },
  { label: "Открытое", interest: 3, patience: 3 },
  { label: "Дружелюбное", interest: 3, patience: 4 },
  { label: "Доверчивое", interest: 3, patience: 5 },
];

export function challengeCounter(scene: TableScene, key: CounterKey) {
  return scene.counters.find(c => c.id === key) ??
    scene.counters.find(c => c.name.trim().toLowerCase() === challengeCounterNames[key].toLowerCase());
}

export function setChallengeCounter(scene: TableScene, key: CounterKey, patch: Partial<Pick<SceneCounter, "value" | "max" | "public">>): TableScene {
  const existing = challengeCounter(scene, key);
  const negotiation = key === "interest" || key === "patience";
  const counter = {
    id: key, name: challengeCounterNames[key],
    value: negotiation ? (key === "interest" ? 2 : 3) : 0,
    max: negotiation ? 5 : key === "successes" ? 6 : 4,
    public: !negotiation,
    ...existing, ...patch,
  };
  if (negotiation) counter.max = 5;
  counter.value = Math.max(0, Math.min(counter.max ?? Infinity, counter.value));
  return { ...scene, counters: existing ? scene.counters.map(c => c === existing ? counter : c) : [...scene.counters, counter] };
}

export function montageState(scene: TableScene) {
  return scene.challenge?.kind === "montage" ? scene.challenge :
    { kind: "montage" as const, rounds: Math.min(99, Math.max(2, scene.round)) };
}
export function negotiationState(scene: TableScene) {
  return scene.challenge?.kind === "negotiation" ? scene.challenge : { kind: "negotiation" as const, traits: [] };
}
export function rememberNegotiationStart(scene: TableScene) {
  const state = negotiationState(scene);
  const { interest, patience } = negotiationProgress(scene);
  return { ...state, initialInterest: state.initialInterest ?? interest, initialPatience: state.initialPatience ?? patience };
}
export function montageLimits(difficulty: MontageDifficulty, heroes: number) {
  const shift = Math.max(1, heroes) - 5;
  const base = { easy: [5, 5], moderate: [6, 4], hard: [7, 3] }[difficulty];
  return { successes: Math.max(2, base[0] + shift), failures: Math.max(2, base[1] + shift) };
}
export function montageVictories(result: MontageResult, difficulty: MontageDifficulty | undefined) {
  if (!difficulty) return undefined;
  if (result === "success") return difficulty === "hard" ? 2 : 1;
  return result === "partial" && difficulty !== "easy" ? 1 : 0;
}

function montageResult(scene: TableScene, timeUp = false): MontageResult | undefined {
  const successes = challengeCounter(scene, "successes");
  const failures = challengeCounter(scene, "failures");
  if ((successes?.value ?? 0) >= (successes?.max ?? 6)) return "success";
  if (!timeUp && (failures?.value ?? 0) < (failures?.max ?? 4)) return undefined;
  return (successes?.value ?? 0) - (failures?.value ?? 0) >= 2 ? "partial" : "failure";
}

export function recordMontage(scene: TableScene, result: "successes" | "failures" | "pass", hero?: string, count = 1): TableScene {
  const state = montageState(scene);
  if (state.result || (hero && state.acted?.includes(hero))) return scene;
  const next = result === "pass" ? scene :
    setChallengeCounter(scene, result, { value: (challengeCounter(scene, result)?.value ?? 0) + count });
  return { ...next, challenge: { ...state,
    acted: hero ? [...(state.acted ?? []), hero] : state.acted,
    result: montageResult(next) } };
}

export function advanceMontage(scene: TableScene): TableScene {
  const state = montageState(scene);
  if (state.result) return scene;
  const result = montageResult(scene, scene.round >= state.rounds);
  return result ? { ...scene, challenge: { ...state, result } } :
    { ...scene, round: scene.round + 1, challenge: { ...state, acted: [] } };
}

export function negotiationProgress(scene: TableScene) {
  const interest = Math.max(0, Math.min(5, challengeCounter(scene, "interest")?.value ?? 2));
  const patience = Math.max(0, Math.min(5, challengeCounter(scene, "patience")?.value ?? 3));
  return { interest, patience, terminal: interest === 0 || interest >= 5 || patience === 0 };
}
export type ArgumentTier = 1 | 2 | 3 | "critical";
export function argumentEffect(tier: ArgumentTier, trait?: NegotiationTrait) {
  if (trait?.kind === "pitfall") return { interest: -1, patience: -1 };
  if (trait?.used) return { interest: 0, patience: -1 };
  if (trait) return { interest: tier === 1 ? 0 : 1, patience: tier === 1 || tier === 2 ? -1 : 0 };
  return { interest: tier === 1 ? -1 : tier === 2 ? 0 : 1, patience: tier === "critical" ? 0 : -1 };
}
export function negotiationArgument(scene: TableScene, tier: ArgumentTier, traitId?: string): TableScene {
  const state = negotiationState(scene);
  const { interest, patience, terminal } = negotiationProgress(scene);
  const trait = state.traits.find(item => item.id === traitId);
  if (state.result || terminal || (traitId && !trait)) return scene;
  const effect = argumentEffect(tier, trait);
  const next = setChallengeCounter(setChallengeCounter(scene, "interest", { value: interest + effect.interest }), "patience", { value: patience + effect.patience });
  return { ...next, challenge: { ...rememberNegotiationStart(scene), researched: false,
    traits: state.traits.map(t => t === trait && t.kind === "motivation" ? { ...t, used: true } : t) } };
}
export function researchNegotiation(scene: TableScene, tier: 1 | 2 | 3): TableScene {
  const state = negotiationState(scene);
  const { patience, terminal } = negotiationProgress(scene);
  if (state.researched || state.result || terminal) return scene;
  const next = tier === 1 ? setChallengeCounter(scene, "patience", { value: patience - 1 }) : scene;
  return { ...next, challenge: { ...rememberNegotiationStart(scene), researched: true } };
}
