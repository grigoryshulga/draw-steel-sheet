import { BUILDER_DATA as data } from "../../../lib/character-builder";
import { BuilderSelection } from "../BuilderSelection";
import { useBuilderStep } from "../BuilderStepContext";

export function CareerStep() {
  const { draft, patch } = useBuilderStep();
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
      <p className="builder-intro">
        Выберите прошлую карьеру: портрет и полное описание появятся в колонке
        справа.
      </p>
      <BuilderSelection
        label="Карьера"
        kind="career"
        options={data.careers.map((c) => ({ name: c.name }))}
        selected={selected}
        codexLabel="Карьера в Кодексе"
        onSelect={(name) => {
          if (name !== draft.career) {
            patch({
              career: name,
              careerSkills: [],
              perkId: "",
              incident: "",
            });
          }
        }}
      />
    </>
  );
}
