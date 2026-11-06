import { BUILDER_DATA as data } from "../../../lib/character-builder";
import { BuilderSelection } from "../BuilderSelection";
import { useBuilderStep } from "../BuilderStepContext";

export function CareerStep() {
  const { draft } = useBuilderStep();
  const selectedSource = data.careers.find((c) => c.name === draft.career);
  const selected = draft.career
    ? {
        name: draft.career,
        description: selectedSource?.benefits,
        articleId: selectedSource?.articleId,
      }
    : null;

  return (
    <>
      <BuilderSelection
        label="Карьера"
        kind="career"
        options={data.careers.map((c) => ({ name: c.name }))}
        selected={selected}
        changesFor={(name) => {
          if (name !== draft.career) {
            return {
              career: name,
              careerSkills: [],
              perkId: "",
              incident: "",
            };
          }
        }}
      />
    </>
  );
}
