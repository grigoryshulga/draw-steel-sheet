import {
  BUILDER_DATA as data,
} from "../../../lib/character-builder";
import { ancestryTraitAbilities, ancestryTraitChoice } from "../../../lib/ancestry-features";
import { AbilityCard } from "../../AbilityCard";
import { ChoiceCard } from "../../ChoiceCard";
import { RuleText } from "../../RuleText";
import { SkillPicker } from "../../SkillPicker";
import { Button, Select } from "../../ui";
import { useBuilderStep } from "../BuilderStepContext";

export function AncestryOptionsStep() {
  const {
    draft,
    patch,
    go,
    hero,
    skillSlots,
    ancestrySkills,
    openTrait,
  } = useBuilderStep();
  const ancestry = data.ancestries.find((a) => a.name === draft.ancestry);
  const traitsSpent =
    ancestry?.traits
      .filter((t) => draft.traits.includes(t.name))
      .reduce((sum, t) => sum + t.cost, 0) ?? 0;

  return (
    <>
      {ancestry ? (
        <>
          <div className="builder-selection-summary">
            <strong>{ancestry.name}</strong>
            <Button variant="ghost" size="sm" onClick={() => go("ancestry")}>Изменить происхождение</Button>
          </div>
          <section className="builder-signature" aria-label="Знаковая черта происхождения">
            <span className="eyebrow">Знаковая черта · получена автоматически</span>
            <RuleText text={ancestry.signature} />
            {ancestry.articleId && (
              <a href={`#/codex/${ancestry.articleId}`} target="_blank" rel="noreferrer">
                Открыть происхождение в Кодексе ↗
              </a>
            )}
          </section>
          <div className="builder-section-head">
            <h3>Черты за очки</h3>
            <div className="builder-budget">
              <strong className="mono">{ancestry.budget - traitsSpent}</strong>
              <span>из {ancestry.budget} очков свободно</span>
            </div>
          </div>
          <div className="builder-choice-grid">
            {ancestry.traits.map((t) => {
              const chosen = draft.traits.includes(t.name);
              const blocked = !chosen && traitsSpent + t.cost > ancestry.budget;
              const abilities = ancestryTraitAbilities(ancestry.name, t.name);
              const choice = ancestryTraitChoice(ancestry.name, t.name);
              const selectedChoice = choice
                ? draft.ancestryChoices?.[choice.group] ?? ""
                : "";
              const selectedAbility = choice?.options.find(
                (option) => option.id === selectedChoice,
              )?.ability;
              return (
                <ChoiceCard
                  key={t.name}
                  eyebrow={
                    choice || abilities.length > 0
                      ? "Знаковая способность"
                      : "Черта происхождения"
                  }
                  title={t.name}
                  meta={`${t.cost} очк.`}
                  selected={chosen}
                  disabled={blocked}
                  onSelect={() =>
                    patch({
                      traits: chosen
                        ? draft.traits.filter((n) => n !== t.name)
                        : [...draft.traits, t.name],
                    })
                  }
                  onOpen={() => openTrait({ name: t.name, text: t.text })}
                >
                  {abilities.map((ability) => (
                    <AbilityCard
                      key={ability.id}
                      ability={ability}
                      character={hero}
                    />
                  ))}
                  {choice && (
                    <div
                      className="builder-trait-choice"
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => event.stopPropagation()}
                    >
                      {chosen ? (
                        <>
                          <label className="builder-trait-choice-label">
                            <span className="eyebrow">
                              Выберите способность
                            </span>
                            <Select
                              value={selectedChoice}
                              aria-label={`${t.name}: выберите способность`}
                              onChange={(event) =>
                                patch({
                                  ancestryChoices: {
                                    ...(draft.ancestryChoices ?? {}),
                                    [choice.group]: event.target.value,
                                  },
                                })
                              }
                            >
                              <option value="">Не выбрана</option>
                              {choice.options.map((option) => (
                                <option key={option.id} value={option.id}>
                                  {option.label}
                                </option>
                              ))}
                            </Select>
                          </label>
                          {selectedAbility && (
                            <AbilityCard
                              ability={selectedAbility}
                              character={hero}
                            />
                          )}
                        </>
                      ) : (
                        <p className="choice-card-summary">
                          Выберите черту, чтобы получить одну из трёх
                          знаковых способностей на выбор.
                        </p>
                      )}
                    </div>
                  )}
                  {!choice && abilities.length === 0 && (
                    <div className="choice-card-clamp">
                      <RuleText text={t.text} />
                    </div>
                  )}
                </ChoiceCard>
              );
            })}
          </div>
          {ancestry.name === "Ревенант" && <p className="builder-notice">Черта «Предыдущая жизнь» требует выбора прошлого происхождения. Запишите этот выбор и его эффекты в особенностях на этапе «Настройка класса».</p>}
          {skillSlots.ancestry.length > 0 && <SkillPicker label="Навыки происхождения" slots={skillSlots.ancestry} values={ancestrySkills} onChange={(ancestrySkills) => patch({ ancestrySkills })} />}
        </>
      ) : <p className="builder-notice">Сначала выберите происхождение.</p>}
    </>
  );
}
