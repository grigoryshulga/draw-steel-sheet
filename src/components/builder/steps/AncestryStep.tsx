import { BUILDER_DATA as data } from "../../../lib/character-builder";
import { BuilderSelection } from "../BuilderSelection";
import { useBuilderStep } from "../BuilderStepContext";

export function AncestryStep() {
  const { draft } = useBuilderStep();
  const selectedSource = data.ancestries.find((a) => a.name === draft.ancestry);
  const selected = draft.ancestry
    ? {
        name: draft.ancestry,
        description: selectedSource?.summary,
        articleId: selectedSource?.articleId,
      }
    : null;

  return (
    <>
      <BuilderSelection
        label="Происхождение"
        kind="ancestry"
        options={data.ancestries.map((a) => ({ name: a.name }))}
        selected={selected}
        changesFor={(name) => {
          if (name !== draft.ancestry) {
            return {
              ancestry: name,
              traits: [],
              ancestrySkills: [],
              ancestryChoices: {},
            };
          }
        }}
      />
    </>
  );
}
