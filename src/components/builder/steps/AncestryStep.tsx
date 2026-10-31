import { BUILDER_DATA as data } from "../../../lib/character-builder";
import { BuilderOptionCard } from "../../BuilderOptionCard";
import { useBuilderStep } from "../BuilderStepContext";
import { selectedFirst } from "../selectedFirst";

export function AncestryStep() {
  const { draft, patch } = useBuilderStep();

  return (
    <>
      <p className="builder-intro">
        Выберите происхождение, чтобы раскрыть его полный текст прямо в карточке.
      </p>
      <div className="builder-option-grid builder-pinned-options">
        {selectedFirst(data.ancestries, (a) => a.name === draft.ancestry).map((a) => {
          const selected = a.name === draft.ancestry;
          return (
            <BuilderOptionCard
              key={a.name}
              kind="ancestry"
              name={a.name}
              summary={a.summary}
              snippet={`${a.summary.slice(0, 155)}${a.summary.length > 155 ? "…" : ""}`}
              selected={selected}
              onSelect={() => {
                if (a.name !== draft.ancestry) {
                  patch({ ancestry: a.name, traits: [], ancestrySkills: [] });
                }
              }}
            />
          );
        })}
      </div>
    </>
  );
}
