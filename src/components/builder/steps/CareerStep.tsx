import { BUILDER_DATA as data } from "../../../lib/character-builder";
import { BuilderOptionCard } from "../../BuilderOptionCard";
import { useBuilderStep } from "../BuilderStepContext";
import { selectedFirst } from "../selectedFirst";

export function CareerStep() {
  const { draft, patch } = useBuilderStep();

  return (
    <>
      <p className="builder-intro">
        Выберите прошлую карьеру, чтобы раскрыть её полный текст прямо в карточке.
      </p>
      <div
        className="builder-option-grid builder-pinned-options builder-career-options"
        role="group"
        aria-label="Карьера"
      >
        {selectedFirst(data.careers, (c) => c.name === draft.career).map((c) => {
          const selected = c.name === draft.career;
          const benefits = c.benefits.split(
            "Вы получаете следующие преимущества карьеры:",
          )[0];
          return (
            <BuilderOptionCard
              key={c.name}
              kind="career"
              name={c.name}
              summary={benefits}
              snippet={`${benefits.slice(0, 155)}…`}
              selected={selected}
              onSelect={() => {
                if (c.name !== draft.career) {
                  patch({
                    career: c.name,
                    careerSkills: [],
                    perkId: "",
                    incident: "",
                  });
                }
              }}
            />
          );
        })}
      </div>
    </>
  );
}
