import { BUILDER_DATA as data } from "../../../lib/character-builder";
import { careerPerkType, PERK_COMPENDIUM } from "../../../data/perks";
import { ChoiceCard } from "../../ChoiceCard";
import { PerkCard } from "../../PerkCard";
import { SkillPicker } from "../../SkillPicker";
import { Button } from "../../ui";
import { useBuilderStep } from "../BuilderStepContext";

export function CareerOptionsStep() {
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
            <strong>{career.name}</strong>
            <Button variant="ghost" size="sm" onClick={() => go("career")}>Изменить карьеру</Button>
          </div>
          <SkillPicker label="Навыки карьеры" slots={skillSlots.career} values={draft.careerSkills} prior={[...ancestrySkills, ...cultureSkills]} onChange={(careerSkills) => patch({ careerSkills })} />
          <div className="builder-section-head">
            <h3>Перк карьеры</h3>
            <span className="muted small">
              {draft.perkId ? "Выбран" : "Выберите 1"}
            </span>
          </div>
          <div className="perk-card-grid">
            {PERK_COMPENDIUM.filter(
              (p) => p.type === careerPerkType(draft.career),
            ).map((p) => (
              <PerkCard
                key={p.id}
                eyebrow="Карьера"
                name={p.name}
                type={p.type}
                summary={p.summary}
                selected={draft.perkId === p.id}
                onSelect={() => patch({ perkId: p.id })}
                onOpen={() => openPerk(p)}
              />
            ))}
          </div>
          <div className="builder-section-head">
            <h3>Побуждающий инцидент</h3>
            <span className="muted small">
              {draft.incident ? "Выбран" : "Выберите 1"}
            </span>
          </div>
          <div className="builder-choice-grid">
            {career.incidents.map((incident, i) => {
              const colon = incident.indexOf(":");
              const title = colon >= 0 ? incident.slice(0, colon).trim() : incident;
              const text = colon >= 0 ? incident.slice(colon + 1).trim() : "";
              return (
                <ChoiceCard
                  key={i}
                  eyebrow="Инцидент"
                  title={title}
                  summary={<div className="choice-card-clamp">{text}</div>}
                  selected={draft.incident === incident}
                  onSelect={() => patch({ incident })}
                  onOpen={() => openIncident({ title, text })}
                />
              );
            })}
          </div>
        </>
      ) : <p className="builder-notice">Сначала выберите карьеру.</p>}
    </>
  );
}
