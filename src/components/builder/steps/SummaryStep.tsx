import { perkById } from "../../../data/perks";
import { CHARACTERISTICS, deriveStats } from "../../../lib/rules";
import { useBuilderStep } from "../BuilderStepContext";

export function SummaryStep() {
  const { draft, hero, flow, goToFlow } = useBuilderStep();
  const derived = deriveStats(hero);
  const rows = [
    { label: "Происхождение", value: draft.ancestry, step: "ancestry" },
    {
      label: "Черты происхождения",
      value: draft.traits.join(", "),
      step: "ancestry-options",
    },
    {
      label: "Культура",
      value: Object.values(draft.culture).filter(Boolean).join(" · "),
      step: "culture",
    },
    { label: "Карьера", value: draft.career, step: "career" },
    {
      label: "Перк",
      value: perkById(draft.perkId)?.name,
      step: "career-options/perk",
    },
    {
      label: "Инцидент",
      value: draft.incident,
      step: "career-options/incident",
    },
    { label: "Класс", value: draft.className, step: "class" },
    {
      label: "Подкласс и домены",
      value: [draft.subclass, draft.domain, draft.conduitDomainFeature]
        .filter(Boolean)
        .join(" · "),
      step: "class-options",
    },
    {
      label: "Характеристики",
      value: CHARACTERISTICS.map(
        (c) => `${c.short} ${hero.characteristics[c.key]}`,
      ).join(" · "),
      step: "class-options/characteristics",
    },
    {
      label: "Навыки",
      value: hero.skills.join(", "),
      step: "class-options/skills",
    },
    {
      label: "Особенности",
      value: Object.values(draft.featureChoices).filter(Boolean).join(", "),
      step: "class-options",
    },
    {
      label: "Комплекты",
      value: [draft.kit, draft.secondaryKit].filter(Boolean).join(", "),
      step: "kit",
    },
    {
      label: "Способности",
      value: hero.abilities.map((a) => a.name).join(", "),
      step: "abilities",
    },
    {
      label: "Имя и личность",
      value: [draft.name, draft.complication, draft.details]
        .filter(Boolean)
        .join(" · "),
      step: "details",
    },
  ];
  const missing = flow.filter((item) => item.issue);
  return (
    <>
      {missing.length > 0 && (
        <div className="builder-notice">
          <strong>Осталось завершить: {missing.length}</strong>
          {missing.map((item) => (
            <button
              className="builder-review-issue"
              type="button"
              key={item.id}
              onClick={() => goToFlow(item.id)}
            >
              {item.label}: {item.issue} →
            </button>
          ))}
        </div>
      )}
      <div className="builder-review">
        {rows.map((row) => {
          const destination =
            flow.find((item) => item.id === row.step) ??
            flow.find((item) => item.step === row.step);
          if (!destination) return null;
          return (
            <button
              type="button"
              key={row.label}
              onClick={() => goToFlow(destination.id)}
            >
              <span>
                <strong>{row.label}</strong>
                <span className="builder-review-value">
                  {row.value || "Не выбрано"}
                </span>
              </span>
              <span className="muted small">Изменить →</span>
            </button>
          );
        })}
      </div>
      <p>
        Выносливость {hero.stamina.max} · Скорость {hero.speed} · Устойчивость{" "}
        {hero.stability} · Восстановления {hero.recoveries.max} ×{" "}
        {derived.recoveryValue}
      </p>
      <details className="builder-reference">
        <summary>Особые условия и эффекты</summary>
        <p>
          Условные эффекты и особенности без авторасчёта остаются в тексте
          правил. Их можно уточнить и дополнить в листе.
        </p>
      </details>
    </>
  );
}
