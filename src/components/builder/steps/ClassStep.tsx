import { BUILDER_DATA as data, startingCharacteristics } from "../../../lib/character-builder";
import { CLASS_PRESETS } from "../../../data/classes";
import { BuilderSelection } from "../BuilderSelection";
import { useBuilderStep } from "../BuilderStepContext";

export function ClassStep() {
  const { draft, patch } = useBuilderStep();
  const selectedSource = data.classes.find((c) => c.name === draft.className);
  const selected = draft.className
    ? {
        name: draft.className,
        description: selectedSource?.summary,
        articleId: selectedSource?.articleId,
      }
    : null;

  return (
    <>
      <p className="builder-intro">
        Выберите класс: портрет и полное описание появятся в колонке справа.
      </p>
      <BuilderSelection
        label="Класс"
        kind="class"
        options={CLASS_PRESETS.map((c) => {
          const source = data.classes.find((d) => d.name === c.name);
          return {
            name: c.name,
            disabled: !source?.basics,
            note: source?.basics ? undefined : "Нет перевода",
          };
        })}
        selected={selected}
        codexLabel="Класс в Кодексе"
        onSelect={(name) => {
          if (name === draft.className) return;
          patch({
            className: name,
            characteristics: startingCharacteristics(name),
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
    </>
  );
}
