import { builderAbilityName, careerIncident, useBuilderNames } from "../choice-language";
import { BUILDER_DATA } from "../../../lib/character-builder";
import { useLocale } from "../../../i18n/locale";
import { englishFlowLabel, englishStages, englishIssue } from "../language";
import { Icon } from "../../Icons";
import { perkById } from "../../../data/perks";
import { CHARACTERISTICS, deriveStats } from "../../../lib/rules";
import { useBuilderStep } from "../BuilderStepContext";
import { BUILDER_STAGES } from "../../../lib/builder-flow";

export function SummaryStep() {
  const { locale, t } = useLocale();
  const { draft, hero, flow, goToFlow } = useBuilderStep();
  const label = useBuilderNames(locale, draft.className);
  const domainLabel = useBuilderNames(locale, "Проводник");
  const career = BUILDER_DATA.careers.find(c => c.name === draft.career);
  const incidentIndex = career?.incidents.indexOf(draft.incident) ?? -1;
  const derived = deriveStats(hero);
  const featureStep = flow.find((item) => item.step === "class-options" && item.part.startsWith("feature:"));
  const rows = [
    { label: t("Происхождение", "Ancestry"), value: label(draft.ancestry), step: "ancestry" },
    {
      label: t("Черты происхождения", "Ancestry traits"),
      value: draft.traits.map(label).join(", "),
      step: "ancestry-options",
    },
    {
      label: t("Культура", "Culture"),
      value: Object.values(draft.culture).filter(Boolean).map(label).join(" · "),
      step: "culture",
    },
    { label: t("Карьера", "Career"), value: label(draft.career), step: "career" },
    {
      label: t("Перк", "Perk"),
      value: label(perkById(draft.perkId)?.name),
      step: "career-options/perk",
    },
    {
      label: t("Инцидент", "Incident"),
      value: locale === "en" && career && incidentIndex >= 0 ? Object.values(careerIncident(career, incidentIndex, locale)).join(": ") : draft.incident,
      step: "career-options/incident",
    },
    { label: t("Класс", "Class"), value: label(draft.className), step: "class" },
    {
      label: t("Подкласс и домены", "Subclass and domains"),
      value: [...draft.subclass.split(", ").map(label), domainLabel(draft.domain), domainLabel(draft.conduitDomainFeature)]
        .filter(Boolean)
        .join(" · "),
      step: "class-options",
    },
    {
      label: t("Характеристики", "Characteristics"),
      value: CHARACTERISTICS.map(
        (c) => `${locale === "en" ? c.key[0].toUpperCase() : c.short} ${hero.characteristics[c.key]}`,
      ).join(" · "),
      step: "class-options/characteristics",
    },
    {
      label: t("Навыки", "Skills"),
      value: hero.skills.map(label).join(", "),
      step: "class-options/skills",
    },
    {
      label: t("Особенности", "Features"),
      value: Object.values(draft.featureChoices).filter(Boolean).map(label).join(", "),
      step: featureStep?.id ?? "class-options",
      hidden: !featureStep,
    },
    {
      label: t("Комплекты", "Kits"),
      value: [draft.kit, draft.secondaryKit].map(label).filter(Boolean).join(", "),
      step: "kit",
    },
    {
      label: t("Способности", "Abilities"),
      value: hero.abilities.map((a) => builderAbilityName(a, locale)).join(", "),
      step: "abilities",
    },
    {
      label: t("Имя и личность", "Name and identity"),
      value: [draft.name, label(draft.complication), draft.details]
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
      <section className="builder-review-overview" aria-label={t("Краткая сводка героя", "Hero overview")}>
        <h3>{draft.name || t("Ваш герой", "Your hero")}</h3>
        <dl>
          <div><dt>{t("Происхождение", "Ancestry")}</dt><dd>{label(draft.ancestry) || t("Не выбрано", "Not selected")}</dd></div>
          <div><dt>{t("Карьера", "Career")}</dt><dd>{label(draft.career) || t("Не выбрана", "Not selected")}</dd></div>
          <div><dt>{t("Класс", "Class")}</dt><dd>{[draft.className, ...draft.subclass.split(", ")].map(label).filter(Boolean).join(" · ") || t("Не выбран", "Not selected")}</dd></div>
        </dl>
      </section>
      {missing.length > 0 && (
        <div className="builder-notice">
          <strong>{t("Осталось завершить", "Choices remaining")}: {missing.length}</strong>
          <p>{t("Следующий шаг", "Next step")}: {locale === "en" ? englishFlowLabel(missing[0]) : missing[0].label}.</p>
          {[...new Set(missing.map((item) => item.stage))].map((stage) => (
            <section className="builder-review-group" key={stage} aria-label={locale === "en" ? englishStages[stage] : BUILDER_STAGES[stage]}>
              <h4>{locale === "en" ? englishStages[stage] : BUILDER_STAGES[stage]} <span className="muted">{missing.filter((item) => item.stage === stage).length}</span></h4>
              {missing.filter((item) => item.stage === stage).map((item) => (
            <button
              className="builder-review-issue"
              type="button"
              key={item.id}
              onClick={() => goToFlow(item.id)}
            >
              {locale === "en" ? englishIssue(item.issue) : item.issue.startsWith("Выберите")
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
                  {row.value || t("Не выбрано", "Not selected")}
                </span>
              </span>
              <span className="muted small">{t("Изменить", "Edit")} <Icon name="arrow-right" size={16} /></span>
            </button>
          );
        })}
      </div>
      <p>
        {t("Выносливость", "Stamina")} {hero.stamina.max} · {t("Скорость", "Speed")} {hero.speed} · {t("Устойчивость", "Stability")}{" "}
        {hero.stability} · {t("Восстановления", "Recoveries")} {hero.recoveries.max} ×{" "}
        {derived.recoveryValue}
      </p>
      <section className="builder-reference">
        <h3>{t("Особые условия и эффекты", "Special conditions and effects")}</h3>
        <p>
          {t("Условные эффекты и особенности без авторасчёта остаются в тексте правил. Их можно уточнить и дополнить в листе.", "Conditional effects and features without automatic calculation remain in the rules text. You can clarify and add them on the sheet.")}
        </p>
      </section>
    </>
  );
}
