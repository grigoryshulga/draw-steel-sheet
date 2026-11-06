import {
  BUILDER_DATA as data,
  startingCharacteristics,
} from "../../../lib/character-builder";
import { CLASS_PRESETS } from "../../../data/classes";
import { BuilderSelection } from "../BuilderSelection";
import { useBuilderStep } from "../BuilderStepContext";

export function ClassStep() {
  const { draft } = useBuilderStep();
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
        changesFor={(name) => {
          if (name === draft.className) return;
          return {
            className: name,
            characteristics: startingCharacteristics(name),
            classSkills: [],
            abilityIds: [],
            subclass: "",
            featureChoices: {},
            domain: "",
            conduitDomainFeature: "",
            kit: "",
            secondaryKit: "",
            meleeDamageKit: "",
            rangedDamageKit: "",
          };
        }}
      />
    </>
  );
}
