import { BUILDER_DATA as data } from "../../../lib/character-builder";
import { featureEquipmentRequirements } from "../../../lib/feature-equipment-requirements";
import { CharacteristicAllocator } from "../../CharacteristicAllocator";
import { FeatureEquipmentFields } from "../../FeatureEquipmentFields";
import { SkillPicker } from "../../SkillPicker";
import { Field, Select } from "../../ui";
import { BuilderSelection } from "../BuilderSelection";
import { Reference } from "../Reference";
import { useBuilderStep } from "../BuilderStepContext";

export function ClassOptionsStep({ part }: { part: string }) {
  const {
    draft,
    pendingChanges,
    patch,
    hero,
    skillSlots,
    ancestrySkills,
    cultureSkills,
    careerSkills,
  } = useBuilderStep();
  const classData = data.classes.find((c) => c.name === draft.className);
  if (!classData) return <p>Сначала выберите класс.</p>;
  const domains = draft.subclass.split(", ").filter(Boolean);
  if (part === "subclass") {
    if (draft.className === "Проводник")
      return (
        <>
          <p className="builder-intro">
            Выберите два разных домена. На следующем шаге выберите, какой из них
            даст особенность 1-го уровня.
          </p>
          {[0, 1].map((i) => (
            <section key={i}>
              <Field label={`Домен ${i + 1}`}>
                <Select
                  value={draft.subclass.split(", ")[i] || ""}
                  onChange={(event) => {
                    const values = draft.subclass.split(", ");
                    values[i] = event.target.value;
                    patch({
                      subclass: values.join(", "),
                      classSkills: [],
                      conduitDomainFeature: values.includes(
                        draft.conduitDomainFeature,
                      )
                        ? draft.conduitDomainFeature
                        : "",
                    });
                  }}
                >
                  <option value="">Выберите домен</option>
                  {classData.subclasses
                    .filter((s) => s.name !== draft.subclass.split(", ")[1 - i])
                    .map((s) => (
                      <option key={s.name}>{s.name}</option>
                    ))}
                </Select>
              </Field>
              <Reference
                label="Правила домена"
                text={
                  classData.subclasses.find(
                    (s) => s.name === draft.subclass.split(", ")[i],
                  )?.text ?? ""
                }
              />
            </section>
          ))}
        </>
      );
    return (
      <BuilderSelection
        key={draft.className}
        label="Подкласс"
        layout="tiles"
        options={classData.subclasses.map((s) => ({
          name: s.name,
          description: s.text,
        }))}
        selected={draft.subclass ? { name: draft.subclass } : null}
        changesFor={(subclass) => ({
          subclass,
          classSkills: [],
          kit: "",
          secondaryKit: "",
          meleeDamageKit: "",
          rangedDamageKit: "",
        })}
      />
    );
  }
  if (part === "domain") {
    const options =
      data.classes
        .find((c) => c.name === "Проводник")
        ?.subclasses.filter(
          (s) => draft.className !== "Проводник" || domains.includes(s.name),
        ) ?? [];
    const name =
      draft.className === "Проводник"
        ? draft.conduitDomainFeature
        : draft.domain;
    return (
      <BuilderSelection
        label="Домен"
        options={options.map((s) => ({ name: s.name, description: s.text }))}
        selected={name ? { name } : null}
        changesFor={(name) => ({
          ...(draft.className === "Проводник"
            ? { conduitDomainFeature: name }
            : { domain: name }),
          classSkills: [],
        })}
      />
    );
  }
  if (part === "characteristics")
    return (
      <CharacteristicAllocator
        className={draft.className}
        value={draft.characteristics}
        onChange={(characteristics) => patch({ characteristics })}
      />
    );
  if (part === "skills")
    return (
      <SkillPicker
        label="Навыки класса"
        slots={skillSlots.class}
        values={draft.classSkills}
        prior={[...ancestrySkills, ...cultureSkills, ...careerSkills]}
        onChange={(classSkills) => patch({ classSkills })}
      />
    );
  const group = classData.featureChoices.find(
    (g) => part === `feature:${g.name}`,
  );
  if (!group) return null;
  const chosenName = draft.featureChoices[group.name];
  const previewName = pendingChanges?.featureChoices?.[group.name] ?? chosenName;
  const equipmentRequirement = featureEquipmentRequirements(draft.className, {
    ...(draft.className === "Проводник" && group.name === "Молитва"
      ? { "conduit.prayer": previewName }
      : {}),
    ...(draft.className === "Талант" &&
    group.name === "Псионическая аугментация"
      ? { "talent.augmentation": previewName }
      : {}),
    ...(draft.className === "Элементалист" && group.name === "Зачарование"
      ? { "elementalist.enchantment": previewName }
      : {}),
  });
  return (
    <>
      <Reference text={group.text} label="Как работает этот выбор" />
      <BuilderSelection
        key={group.name}
        label={group.name}
        options={group.options.map((o) => ({
          name: o.name,
          description: o.text,
        }))}
        selected={chosenName ? { name: chosenName } : null}
        changesFor={(name) => ({
          featureChoices: { ...draft.featureChoices, [group.name]: name },
        })}
      />
      {equipmentRequirement && (
        <FeatureEquipmentFields
          value={draft.equipment}
          hasKit={Boolean(hero.kit.trim() || hero.secondaryKit?.trim())}
          automationEnabled={hero.automation?.enabled ?? false}
          onChange={(equipment) => patch({ equipment })}
        />
      )}
    </>
  );
}
