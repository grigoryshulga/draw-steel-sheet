export const BUILDER_STEPS = [
  { id: "concept", label: "Замысел" },
  { id: "ancestry", label: "Происхождение" },
  { id: "ancestry-options", label: "Черты происхождения" },
  { id: "culture", label: "Культура" },
  { id: "career", label: "Карьера" },
  { id: "career-options", label: "Навыки и преимущества карьеры" },
  { id: "class", label: "Класс" },
  { id: "class-options", label: "Настройка класса" },
  { id: "kit", label: "Комплект" },
  { id: "abilities", label: "Способности" },
  { id: "details", label: "Детали" },
  { id: "summary", label: "Готовый герой" },
] as const;

export type BuilderStepId = (typeof BUILDER_STEPS)[number]["id"];
export const BUILDER_STEP_IDS: readonly BuilderStepId[] = BUILDER_STEPS.map(
  ({ id }) => id,
);
export const BUILDER_STEP_V2_KEY = "ds-builder-step-v2";
export const LEGACY_BUILDER_STEP_V1_KEY = "ds-builder-step-v1";

export function isBuilderStepId(value: unknown): value is BuilderStepId {
  return typeof value === "string" && BUILDER_STEP_IDS.includes(value as BuilderStepId);
}

export function builderStepIndex(step: BuilderStepId): number {
  return BUILDER_STEP_IDS.indexOf(step);
}

export function nextBuilderStep(step: BuilderStepId): BuilderStepId {
  return BUILDER_STEP_IDS[Math.min(builderStepIndex(step) + 1, BUILDER_STEP_IDS.length - 1)];
}

export function previousBuilderStep(step: BuilderStepId): BuilderStepId {
  return BUILDER_STEP_IDS[Math.max(builderStepIndex(step) - 1, 0)];
}

export function migrateLegacyBuilderStep(
  raw: string | null,
  selected: { ancestry?: boolean; career?: boolean; className?: boolean } = {},
): BuilderStepId {
  if (raw === null || !/^(0|[1-8])$/.test(raw)) return "concept";
  const oldStep = Number(raw);
  const mapping: BuilderStepId[] = [
    "concept",
    selected.ancestry ? "ancestry-options" : "ancestry",
    "culture",
    selected.career ? "career-options" : "career",
    selected.className ? "class-options" : "class",
    "kit",
    "abilities",
    "details",
    "summary",
  ];
  return mapping[oldStep] ?? "concept";
}

export function restoreBuilderStep(
  current: string | null,
  legacy: string | null,
  selected: { ancestry?: boolean; career?: boolean; className?: boolean } = {},
): BuilderStepId {
  if (isBuilderStepId(current)) return current;
  return migrateLegacyBuilderStep(legacy, selected);
}
