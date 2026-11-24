import { careerIncident } from "../choice-language";
import { useLocale } from "../../../i18n/locale";
import { BUILDER_DATA as data } from "../../../lib/character-builder";
import { careerPerkType, PERK_COMPENDIUM } from "../../../data/perks";
import { ChoiceCard } from "../../ChoiceCard";
import { PerkCard } from "../../PerkCard";
import { SkillPicker } from "../../SkillPicker";
import { Button } from "../../ui";
import { useBuilderStep } from "../BuilderStepContext";

export function CareerOptionsStep({ part }: { part: string }) {
  const { locale, t: tr } = useLocale();
  const {
    draft,
    patch,
    go,
    skillSlots,
    ancestrySkills,
    cultureSkills,
    openPerk,
    openIncident,
  } = useBuilderStep();
  const career = data.careers.find((c) => c.name === draft.career);

  return (
    <>
      {career ? (
        <>
          <div className="builder-selection-summary">
            <strong>{locale === "en" && career.originalName ? career.originalName : career.name}</strong>
            <Button variant="ghost" size="sm" onClick={() => go("career")}>
              {tr("Изменить карьеру", "Change career ").trim()}
            </Button>
          </div>
          {part === "skills" && (
            <SkillPicker
              hideTitle
              label={tr("Навыки карьеры", "Career skills")}
              slots={skillSlots.career}
              values={draft.careerSkills}
              prior={[...ancestrySkills, ...cultureSkills]}
              onChange={(careerSkills) => patch({ careerSkills })}
            />
          )}
          {part === "perk" && (
            <>
              <div className="builder-section-head">
                <h3>{tr("Перк карьеры", "Career perk")}</h3>
              </div>
              <div className="perk-card-grid">
                {PERK_COMPENDIUM.filter(
                  (p) => p.type === careerPerkType(draft.career),
                ).map((p) => (
                  <PerkCard
                    banded
                    key={p.id}
                    eyebrow={tr("Карьера", "Career")}
                    name={locale === "en" && p.originalName ? p.originalName : p.name}
                    type={p.type}
                    summary={locale === "en" && p.originalDescription ? p.originalDescription : p.summary}
                    selected={draft.perkId === p.id}
                    onSelect={() => patch({ perkId: p.id })}
                    onOpen={() => openPerk(p)}
                  />
                ))}
              </div>
            </>
          )}
          {part === "incident" && (
            <>
              <div className="builder-section-head">
                <h3>{tr("Побуждающий инцидент", "Inciting incident")}</h3>
              </div>
              <div className="builder-choice-grid">
                {career.incidents.map((incident, i) => {
                  const { title, text } = careerIncident(career, i, locale);
                  return (
                    <ChoiceCard
                      key={i}
                      eyebrow={tr("Инцидент", "Incident")}
                      title={title}
                      summary={text}
                      selected={draft.incident === incident}
                      onSelect={() => patch({ incident })}
                      onOpen={() => openIncident({ title, text })}
                    />
                  );
                })}
              </div>
            </>
          )}
        </>
      ) : (
        <p className="builder-notice">{tr("Сначала выберите карьеру.", "Choose a career first.")}</p>
      )}
    </>
  );
}
