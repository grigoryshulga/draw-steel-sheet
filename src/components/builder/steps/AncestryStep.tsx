import { BUILDER_DATA as data } from "../../../lib/character-builder";
import { BuilderSelection } from "../BuilderSelection";
import { useBuilderStep } from "../BuilderStepContext";

export function AncestryStep() {
  const { draft, patch } = useBuilderStep();
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
      <p className="builder-intro">
        Выберите происхождение: портрет и полное описание появятся в колонке
        справа.
      </p>
      <BuilderSelection
        label="Происхождение"
        kind="ancestry"
        options={data.ancestries.map((a) => ({ name: a.name }))}
        selected={selected}
        codexLabel="Происхождение в Кодексе"
        onSelect={(name) => {
          if (name !== draft.ancestry) {
            patch({ ancestry: name, traits: [], ancestrySkills: [] });
          }
        }}
      />
    </>
  );
}
