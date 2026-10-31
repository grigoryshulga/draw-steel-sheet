import { BUILDER_DATA as data, startingCharacteristics } from "../../../lib/character-builder";
import { CLASS_PRESETS } from "../../../data/classes";
import { BuilderOptionCard } from "../../BuilderOptionCard";
import { useBuilderStep } from "../BuilderStepContext";

export function ClassStep() {
  const { draft, patch } = useBuilderStep();

  return (
    <>
      <p className="builder-intro">
        Выберите класс, чтобы раскрыть его полное описание прямо в карточке.
      </p>
      <div className="builder-option-grid builder-class-options">
        {[...CLASS_PRESETS]
          .sort((a, b) => {
            const score = (name: string) =>
              name === draft.className ? 0 : 1;
            return score(a.name) - score(b.name);
          })
          .map((c) => {
            const source = data.classes.find((d) => d.name === c.name);
            const selected = c.name === draft.className;
            return (
              <BuilderOptionCard
                key={c.name}
                kind="class"
                name={c.name}
                summary={source?.summary}
                snippet={
                  source?.basics
                    ? `${source.summary.slice(0, 155)}${source.summary.length > 155 ? "…" : ""}`
                    : "Раздел пока пуст в переводе"
                }
                selected={selected}
                disabled={!source?.basics}
                onSelect={() => {
                  if (c.name === draft.className) return;
                  patch({
                    className: c.name,
                    characteristics: startingCharacteristics(c.name),
                    classSkills: [],
                    abilityIds: [],
                    subclass: "",
                    features: "",
                    featureChoices: {},
                    domain: "",
                    conduitDomainFeature: "",
                    kit: "",
                    secondaryKit: "",
                    meleeDamageKit: "",
                    rangedDamageKit: "",
                  });
                }}
              />
            );
          })}
      </div>
    </>
  );
}
