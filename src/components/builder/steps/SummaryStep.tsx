import { Icon } from "../../Icons";
import { perkById } from "../../../data/perks";
import { CHARACTERISTICS, deriveStats } from "../../../lib/rules";
import { useBuilderStep } from "../BuilderStepContext";
import { BUILDER_STAGES } from "../../../lib/builder-flow";

export function SummaryStep() {
  const { draft, hero, flow, goToFlow } = useBuilderStep();
  const derived = deriveStats(hero);
  const featureStep = flow.find((item) => item.step === "class-options" && item.part.startsWith("feature:"));
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
      step: featureStep?.id ?? "class-options",
      hidden: !featureStep,
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
  const missing = flow.filter((item) => item.issue).filter((item) => {
    if (!draft.ancestry && item.step === "ancestry-options") return false;
    if (!draft.career && item.step === "career-options") return false;
    if (!draft.className && ["class-options", "abilities", "kit"].includes(item.step)) return false;
    return true;
  });
  return (
    <>
      <section className="builder-review-overview" aria-label="Краткая сводка героя">
        <h3>{draft.name || "Ваш герой"}</h3>
        <dl>
          <div><dt>Происхождение</dt><dd>{draft.ancestry || "Не выбрано"}</dd></div>
          <div><dt>Карьера</dt><dd>{draft.career || "Не выбрана"}</dd></div>
          <div><dt>Класс</dt><dd>{[draft.className, draft.subclass].filter(Boolean).join(" · ") || "Не выбран"}</dd></div>
        </dl>
      </section>
      {missing.length > 0 && (
        <div className="builder-notice">
          <strong>Осталось завершить: {missing.length}</strong>
          <p>Следующий шаг: {missing[0].label}.</p>
          {[...new Set(missing.map((item) => item.stage))].map((stage) => (
            <section className="builder-review-group" key={stage} aria-label={BUILDER_STAGES[stage]}>
              <h4>{BUILDER_STAGES[stage]} <span className="muted">{missing.filter((item) => item.stage === stage).length}</span></h4>
              {missing.filter((item) => item.stage === stage).map((item) => (
            <button
              className="builder-review-issue"
              type="button"
              key={item.id}
              onClick={() => goToFlow(item.id)}
            >
              {item.issue.startsWith("Выберите")
                ? item.issue.replace(/^Выберите:\s*организация\./, "Выберите организацию.").replace(/^Выберите:\s*/, "Выберите ")
                : `${item.label}: ${item.issue}`} <Icon name="arrow-right" size={16} />
            </button>
              ))}
            </section>
          ))}
        </div>
      )}
      <div className="builder-review">
        {rows.map((row) => {
          if (row.hidden) return null;
          if (!row.value && (
            (!draft.ancestry && row.step === "ancestry-options") ||
            (!draft.career && row.step.startsWith("career-options")) ||
            (!draft.className && ["class-options", "kit", "abilities"].some((step) => row.step.startsWith(step)))
          )) return null;
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
              <span className="muted small">Изменить <Icon name="arrow-right" size={16} /></span>
            </button>
          );
        })}
      </div>
      <p>
        Выносливость {hero.stamina.max} · Скорость {hero.speed} · Устойчивость{" "}
        {hero.stability} · Восстановления {hero.recoveries.max} ×{" "}
        {derived.recoveryValue}
      </p>
      <section className="builder-reference">
        <h3>Особые условия и эффекты</h3>
        <p>
          Условные эффекты и особенности без авторасчёта остаются в тексте
          правил. Их можно уточнить и дополнить в листе.
        </p>
      </section>
    </>
  );
}
