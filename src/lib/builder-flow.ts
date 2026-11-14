import {
  BUILDER_DATA,
  builderSkillSelections,
  builderStepIssues,
  selectableClassAbilities,
  validCharacteristicArray,
  type BuilderDraft,
} from "./character-builder";
import { canUseKit, CLASS_SIGNATURE_COUNTS } from "../data/creation-rules";
import { selectableKitByName } from "../data/kits";
import { careerPerkType, perkById } from "../data/perks";
import { resolveSkillSelection } from "./skill-selection";
import { restoreBuilderStep, type BuilderStepId } from "./builder-steps";

export const BUILDER_FLOW_KEY = "ds-builder-flow-v3";
export const BUILDER_STAGES = [
  "Происхождение",
  "Предыстория",
  "Класс",
  "Снаряжение",
  "Способности",
  "Личность",
  "Проверка",
] as const;
export interface BuilderFlowStep {
  id: string;
  step: BuilderStepId;
  part: string;
  stage: number;
  label: string;
  issue: string;
}

/** Одна классификация способностей для UI, счётчиков и проверки выбора. */
export function builderAbilityGroups(draft: BuilderDraft) {
  const entries = selectableClassAbilities(draft);
  return [
    {
      id: "signature",
      label: "Знаковые способности",
      count: CLASS_SIGNATURE_COUNTS[draft.className] ?? 0,
      entries: entries.filter((a) => a.kind === "signature"),
    },
    ...[3, 5].map((cost) => ({
      id: String(cost),
      label: `Способность стоимостью ${cost} ед. ресурса`,
      count: 1,
      entries: entries.filter((a) => a.resourceCost === cost),
    })),
    {
      id: "other",
      label: "Другие способности и триггеры",
      count: draft.className === "Проводник" ? 1 : null,
      entries: entries.filter(
        (a) => a.kind !== "signature" && ![3, 5].includes(a.resourceCost),
      ),
    },
  ].filter((group) => group.entries.length > 0 && group.count !== 0);
}

/** Последовательность зависит от принятых решений, но не меняет формат черновика. */
export function builderFlow(draft: BuilderDraft): BuilderFlowStep[] {
  const issues = builderStepIssues(draft);
  const skills = builderSkillSelections(draft);
  const classSkills = resolveSkillSelection(skills.slots.class, draft.classSkills, [
    ...skills.ancestry,
    ...skills.culture,
    ...skills.career,
  ]);
  const classData = BUILDER_DATA.classes.find(
    (c) => c.name === draft.className,
  );
  const career = BUILDER_DATA.careers.find((c) => c.name === draft.career);
  const flow: BuilderFlowStep[] = [];
  const add = (
    stage: number,
    step: BuilderStepId,
    label: string,
    issue = "",
    part = "",
  ) => {
    flow.push({
      id: part ? `${step}/${part}` : step,
      step,
      part,
      stage,
      label,
      issue,
    });
  };
  add(0, "ancestry", "Выберите происхождение", issues.ancestry);
  add(0, "ancestry-options", "Черты происхождения", issues["ancestry-options"]);
  for (const [key, label] of [
    ["environment", "Окружение"],
    ["organization", "Организация"],
    ["upbringing", "Воспитание"],
  ] as const) {
    add(
      1,
      "culture",
      label,
      BUILDER_DATA.cultures[key].some((o) => o.name === draft.culture[key])
        ? ""
        : `Выберите: ${label.toLowerCase()}.`,
      key,
    );
  }
  add(
    1,
    "culture",
    "Навыки культуры",
    resolveSkillSelection(
      skills.slots.culture,
      draft.cultureSkills,
      skills.ancestry,
    ).complete
      ? ""
      : "Выберите три разных навыка культуры.",
    "skills",
  );
  add(1, "career", "Выберите карьеру", issues.career);
  add(
    1,
    "career-options",
    "Навыки карьеры",
    !career
      ? issues.career
      : resolveSkillSelection(skills.slots.career, draft.careerSkills, [
            ...skills.ancestry,
            ...skills.culture,
          ]).complete
        ? ""
        : "Заполните навыки карьеры; повторяющиеся навыки замените.",
    "skills",
  );
  add(
    1,
    "career-options",
    "Перк карьеры",
    career && perkById(draft.perkId)?.type === careerPerkType(draft.career)
      ? ""
      : "Выберите перк карьеры.",
    "perk",
  );
  add(
    1,
    "career-options",
    "Побуждающий инцидент",
    career?.incidents.includes(draft.incident)
      ? ""
      : "Выберите побуждающий инцидент.",
    "incident",
  );
  add(2, "class", "Выберите класс", issues.class);
  const domains = draft.subclass.split(", ").filter(Boolean);
  const subclassValid =
    draft.className === "Проводник"
      ? new Set(domains).size === 2 &&
        domains.every((name) =>
          classData?.subclasses.some((s) => s.name === name),
        )
      : classData?.subclasses.some((s) => s.name === draft.subclass);
  add(
    2,
    "class-options",
    draft.className === "Проводник" ? "Домены" : "Подкласс",
    subclassValid ? "" : "Выберите подкласс (для проводника — два домена).",
    "subclass",
  );
  if (draft.className === "Цензор" || draft.className === "Проводник") {
    const valid =
      draft.className === "Проводник"
        ? domains.includes(draft.conduitDomainFeature)
        : BUILDER_DATA.classes
            .find((c) => c.name === "Проводник")
            ?.subclasses.some((s) => s.name === draft.domain);
    add(
      2,
      "class-options",
      draft.className === "Проводник"
        ? "Домен для особенности 1-го уровня"
        : "Домен цензора",
      valid ? "" : "Выберите домен.",
      "domain",
    );
  }
  add(
    2,
    "class-options",
    "Характеристики",
    validCharacteristicArray(draft)
      ? ""
      : "Распределите характеристики по одному из наборов класса.",
    "characteristics",
  );
  add(
    2,
    "class-options",
    "Навыки класса",
    classSkills.complete
      ? ""
      : `Выбрано ${classSkills.selected.length} из ${classSkills.required}. ${classSkills.invalid.length > 0 ? "Замените недопустимые и повторяющиеся навыки." : "Завершите выбор навыков класса."}`,
    "skills",
  );
  classData?.featureChoices.forEach((group) =>
    add(
      2,
      "class-options",
      group.name,
      group.options.some((o) => o.name === draft.featureChoices[group.name])
        ? ""
        : `Выберите: ${group.name}.`,
      `feature:${group.name}`,
    ),
  );
  if (canUseKit(draft.className, draft.subclass)) {
    add(
      3,
      "kit",
      "Выберите комплект",
      selectableKitByName(draft.kit, draft.className, draft.subclass) ? "" : "Выберите комплект.",
      "primary",
    );
    if (draft.className === "Тактик") {
      add(
        3,
        "kit",
        "Второй комплект",
        selectableKitByName(draft.secondaryKit, draft.className, draft.subclass) && draft.secondaryKit !== draft.kit
          ? ""
          : "Выберите второй, отличный комплект.",
        "secondary",
      );
      add(3, "kit", "Бонусы двух комплектов", "", "bonuses");
    }
  }
  const groups = builderAbilityGroups(draft);
  groups.forEach((group) => {
    const count = group.entries.filter((a) =>
      draft.abilityIds.includes(a.id),
    ).length;
    add(
      4,
      "abilities",
      group.label,
      group.count !== null && count !== group.count
        ? `Выбрано ${count} из ${group.count}.`
        : "",
      group.id,
    );
  });
  // Сохраняем точку входа, когда класс ещё не выбран.
  if (!groups.length)
    add(4, "abilities", "Способности", issues.class || issues.abilities);
  add(
    5,
    "details",
    "Личность героя",
    draft.name.trim() ? "" : "Дайте герою имя.",
  );
  add(6, "summary", "Проверьте своего героя");
  return flow;
}

export function restoreBuilderFlow(
  draft: BuilderDraft,
  saved: string | null,
  v2: string | null,
  v1: string | null,
): string {
  const flow = builderFlow(draft);
  if (saved && flow.some((s) => s.id === saved)) return saved;
  const old =
    saved?.split("/")[0] ??
    restoreBuilderStep(v2, v1, {
      ancestry: !!draft.ancestry,
      career: !!draft.career,
      className: !!draft.className,
    });
  if (old === "concept")
    return v2 === "concept" || v1 === "0" ? "details" : flow[0].id;
  return flow.find((s) => s.step === old)?.id ?? flow[0].id;
}

/** Проверяет и применяет выбор до вычисления следующего динамического шага. */
export function advanceBuilderFlow(
  draft: BuilderDraft,
  id: string,
  changes: Partial<BuilderDraft> = {},
  blocked = "",
) {
  const candidate = { ...draft, ...changes };
  const flow = builderFlow(candidate);
  const index = flow.findIndex((item) => item.id === id);
  const issue =
    blocked ||
    flow[index]?.issue ||
    (index < 0 ? "Выберите доступный шаг." : "");
  return issue
    ? { draft, id, issue }
    : {
        draft: candidate,
        id: flow[Math.min(index + 1, flow.length - 1)].id,
        issue: "",
      };
}
